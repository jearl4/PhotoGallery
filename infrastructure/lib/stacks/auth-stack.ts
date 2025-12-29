import * as cdk from 'aws-cdk-lib';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import { Construct } from 'constructs';

interface AuthStackProps extends cdk.StackProps {
  stage: string;
}

export class AuthStack extends cdk.Stack {
  public readonly userPool: cognito.UserPool;
  public readonly userPoolClient: cognito.UserPoolClient;

  constructor(scope: Construct, id: string, props: AuthStackProps) {
    super(scope, id, props);

    // Cognito User Pool for photographer authentication
    this.userPool = new cognito.UserPool(this, 'PhotographerUserPool', {
      userPoolName: `photographer-gallery-${props.stage}`,
      selfSignUpEnabled: true,
      signInAliases: {
        email: true,
      },
      autoVerify: {
        email: true,
      },
      standardAttributes: {
        email: {
          required: true,
          mutable: true,
        },
        fullname: {
          required: true,
          mutable: true,
        },
      },
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: false,
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy: props.stage === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    // Social Identity Providers (Google, Facebook, Apple)
    // These can be added later through AWS Console or by providing credentials via environment variables:
    // - GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
    // - FACEBOOK_APP_ID, FACEBOOK_APP_SECRET
    // - APPLE_SERVICES_ID, APPLE_TEAM_ID, APPLE_KEY_ID, APPLE_PRIVATE_KEY

    // For now, we'll use Cognito's built-in email/password authentication

    // App Client
    this.userPoolClient = new cognito.UserPoolClient(this, 'PhotographerUserPoolClient', {
      userPool: this.userPool,
      userPoolClientName: `photographer-gallery-client-${props.stage}`,
      authFlows: {
        userPassword: true,
        userSrp: true,
      },
      oAuth: {
        flows: {
          authorizationCodeGrant: true,
        },
        scopes: [
          cognito.OAuthScope.EMAIL,
          cognito.OAuthScope.OPENID,
          cognito.OAuthScope.PROFILE,
        ],
        callbackUrls: [
          'http://localhost:4200/auth/callback', // Development
          // Add production URLs here
        ],
        logoutUrls: [
          'http://localhost:4200/login', // Development
          // Add production URLs here
        ],
      },
      supportedIdentityProviders: [
        cognito.UserPoolClientIdentityProvider.COGNITO,
      ],
    });

    // Hosted UI Domain
    const domain = this.userPool.addDomain('CognitoDomain', {
      cognitoDomain: {
        domainPrefix: `photographer-gallery-${props.stage}-${this.account.substring(0, 8)}`,
      },
    });

    // Outputs
    new cdk.CfnOutput(this, 'UserPoolId', {
      value: this.userPool.userPoolId,
      exportName: `UserPoolId-${props.stage}`,
    });

    new cdk.CfnOutput(this, 'UserPoolClientId', {
      value: this.userPoolClient.userPoolClientId,
      exportName: `UserPoolClientId-${props.stage}`,
    });

    new cdk.CfnOutput(this, 'CognitoDomain', {
      value: domain.domainName,
      exportName: `CognitoDomain-${props.stage}`,
    });
  }
}
