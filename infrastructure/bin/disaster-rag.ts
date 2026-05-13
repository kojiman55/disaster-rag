#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { DisasterRagStack } from "../lib/disaster-rag-stack";

const app = new cdk.App();
new DisasterRagStack(app, "DisasterRagStack", {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: "ap-northeast-1",
  },
});
