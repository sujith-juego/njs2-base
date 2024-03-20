const pjson = require('../package.json');
const GlobalMethods = require('../helper/globalMethods');
const path = require("path");
const [
  AWS_REGION,
  AWS_ACCESS_KEY_ID,
  AWS_SECRET_ACCESS_KEY_ID,
  AWS_ROLE_ARN
] = GlobalMethods.loadConfig(["AWS_REGION", "AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY_ID", "AWS_ROLE_ARN"], pjson.name);
const {LAMBDA} = require(path.join(process.cwd(), "src/config/config.json"));
const {STS, Lambda} = require("@aws-sdk/client-lambda");
const awsHelper = {};
// Assume role to make aws sdk calls.
awsHelper.getCrossAccountCredentials = async () => {
  return new Promise((resolve, reject) => {
    if (!AWS_ROLE_ARN || !AWS_ROLE_ARN.length) {
      resolve({
        region: AWS_REGION,
        accessKeyId: AWS_ACCESS_KEY_ID,
        secretAccessKey: AWS_SECRET_ACCESS_KEY_ID
      });
    } else {
      const sts = new STS({
        region: AWS_REGION,
        credentials: {
          accessKeyId: AWS_ACCESS_KEY_ID,
          secretAccessKey: AWS_SECRET_ACCESS_KEY_ID,
        },
      });
      const timestamp = (new Date()).getTime();
      const params = {
        RoleArn: AWS_ROLE_ARN,
        RoleSessionName: `AWS-WEBSOCKET-${timestamp}`
      };

      sts.assumeRole(params, (err, data) => {
        if (err) reject(err);
        else {
          resolve({
            region: AWS_REGION,
            accessKeyId: data.Credentials.AccessKeyId,
            secretAccessKey: data.Credentials.SecretAccessKey,
            sessionToken: data.Credentials.SessionToken,
          });
        }
      });
    }
  });
};

awsHelper.executeFromLambda = async (functionDetail) => {
    
    try {

      let lambdaConfig = {
        apiVersion: '2015-03-31',
        region: LAMBDA.AWS_REGION,
        endpoint: LAMBDA.END_POINT,
        credentials: {
          accessKeyId: "any",
          secretAccessKey: "any"
        }
      };

      const lambda = new Lambda(lambdaConfig);

      const payload = {
        "headers" :{
          "content-type" : "application/x-www-form-urlencoded"            
        },
        "stageVariables": {
          "requestType": "mCron",
          "taskName": functionDetail.name
        } 
      }
      
      const lambdaParams = {
        FunctionName: LAMBDA.LAMBDA_FUNCTION_NAME, 
        InvocationType: "Event",
        Payload: JSON.stringify(payload)
      };
      const { StatusCode } = await lambda.invoke(lambdaParams).promise();

      console.log("Lambda Execution ", StatusCode === 202 ? "Successful": "Failed");

    } catch (error) {
      console.error(`Lambda execution failed
      ${error}`);
    }
}

module.exports = awsHelper;