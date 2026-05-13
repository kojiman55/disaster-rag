import * as cdk from "aws-cdk-lib";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as events from "aws-cdk-lib/aws-events";
import * as targets from "aws-cdk-lib/aws-events-targets";
import * as iam from "aws-cdk-lib/aws-iam";
import * as location from "aws-cdk-lib/aws-location";
import { Construct } from "constructs";
import * as path from "path";

export class DisasterRagStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // ── S3: データバケット ──────────────────────────────────
    const dataBucket = new s3.Bucket(this, "DataBucket", {
      bucketName: `disaster-rag-data-${this.account}`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // ── S3: フロントエンドバケット ─────────────────────────
    const frontendBucket = new s3.Bucket(this, "FrontendBucket", {
      bucketName: `disaster-rag-frontend-${this.account}`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // ── CloudFront ─────────────────────────────────────────
    const distribution = new cloudfront.Distribution(this, "Distribution", {
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(frontendBucket),
        viewerProtocol: cloudfront.ViewerProtocol.REDIRECT_TO_HTTPS,
      },
      defaultRootObject: "index.html",
      errorResponses: [
        { httpStatus: 403, responseHttpStatus: 200, responsePagePath: "/index.html" },
        { httpStatus: 404, responseHttpStatus: 200, responsePagePath: "/index.html" },
      ],
    });

    // ── Amazon Location Service ────────────────────────────
    const placeIndex = new location.CfnPlaceIndex(this, "PlaceIndex", {
      indexName: "disaster-rag-index",
      dataSource: "Esri",
      description: "Geocoding for DisasterRAG",
    });

    // ── Lambda IAM Role ────────────────────────────────────
    const lambdaRole = new iam.Role(this, "LambdaRole", {
      assumedBy: new iam.ServicePrincipal("lambda.amazonaws.com"),
      managedPolicies: [iam.ManagedPolicy.fromAwsManagedPolicyName("service-role/AWSLambdaBasicExecutionRole")],
    });
    dataBucket.grantReadWrite(lambdaRole);
    lambdaRole.addToPolicy(new iam.PolicyStatement({
      actions: ["secretsmanager:GetSecretValue"],
      resources: [
        `arn:aws:secretsmanager:${this.region}:${this.account}:secret:disaster-rag/*`,
      ],
    }));
    lambdaRole.addToPolicy(new iam.PolicyStatement({
      actions: ["geo:SearchPlaceIndexForText"],
      resources: [`arn:aws:geo:${this.region}:${this.account}:place-index/${placeIndex.indexName}`],
    }));

    const commonEnv = {
      BUCKET_NAME: dataBucket.bucketName,
      LOCATION_INDEX_NAME: placeIndex.indexName,
    };

    // ── Lambda: disaster-query ─────────────────────────────
    const queryFn = new lambda.Function(this, "QueryFunction", {
      functionName: "disaster-rag-query",
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: "index.handler",
      code: lambda.Code.fromAsset(path.join(__dirname, "../../backend/dist/functions/disaster-query")),
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
      role: lambdaRole,
      environment: { ...commonEnv, FRONTEND_ORIGIN: `https://${distribution.distributionDomainName}` },
    });

    // ── Lambda: weather-update ─────────────────────────────
    const weatherFn = new lambda.Function(this, "WeatherUpdateFunction", {
      functionName: "disaster-rag-weather-update",
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: "index.handler",
      code: lambda.Code.fromAsset(path.join(__dirname, "../../backend/dist/functions/weather-update")),
      timeout: cdk.Duration.seconds(60),
      memorySize: 256,
      role: lambdaRole,
      environment: commonEnv,
    });

    // ── Lambda: hazard-update ──────────────────────────────
    const hazardFn = new lambda.Function(this, "HazardUpdateFunction", {
      functionName: "disaster-rag-hazard-update",
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: "index.handler",
      code: lambda.Code.fromAsset(path.join(__dirname, "../../backend/dist/functions/hazard-update")),
      timeout: cdk.Duration.minutes(10),
      memorySize: 512,
      role: lambdaRole,
      environment: commonEnv,
    });

    // ── EventBridge: weather 5分ごと ───────────────────────
    new events.Rule(this, "WeatherSchedule", {
      schedule: events.Schedule.rate(cdk.Duration.minutes(5)),
      targets: [new targets.LambdaFunction(weatherFn)],
    });

    // ── EventBridge: hazard 月1回 ──────────────────────────
    new events.Rule(this, "HazardSchedule", {
      schedule: events.Schedule.cron({ day: "1", hour: "2", minute: "0" }),
      targets: [new targets.LambdaFunction(hazardFn)],
    });

    // ── API Gateway ────────────────────────────────────────
    const api = new apigateway.RestApi(this, "Api", {
      restApiName: "disaster-rag-api",
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
      },
    });

    const queryResource = api.root.addResource("query");
    queryResource.addMethod("POST", new apigateway.LambdaIntegration(queryFn));

    // ── Outputs ────────────────────────────────────────────
    new cdk.CfnOutput(this, "ApiUrl",          { value: api.url });
    new cdk.CfnOutput(this, "CloudFrontUrl",   { value: `https://${distribution.distributionDomainName}` });
    new cdk.CfnOutput(this, "DataBucketName",  { value: dataBucket.bucketName });
    new cdk.CfnOutput(this, "FrontendBucket",  { value: frontendBucket.bucketName });
    new cdk.CfnOutput(this, "DistributionId",  { value: distribution.distributionId });
  }
}
