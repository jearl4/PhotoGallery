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

    // Google Identity Provider
    const googleProvider = new cognito.UserPoolIdentityProviderGoogle(this, 'GoogleProvider', {
      userPool: this.userPool,
      clientId: process.env.GOOGLE_CLIENT_ID || 'placeholder-google-client-id',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || 'placeholder-google-secret',
      scopes: ['profile', 'email', 'openid'],
      attributeMapping: {
        email: cognito.ProviderAttribute.GOOGLE_EMAIL,
        fullname: cognito.ProviderAttribute.GOOGLE_NAME,
      },
    });

    // Facebook Identity Provider
    const facebookProvider = new cognito.UserPoolIdentityProviderFacebook(this, 'FacebookProvider', {
      userPool: this.userPool,
      clientId: process.env.FACEBOOK_APP_ID || 'placeholder-facebook-app-id',
      clientSecret: process.env.FACEBOOK_APP_SECRET || 'placeholder-facebook-secret',
      scopes: ['public_profile', 'email'],
      attributeMapping: {
        email: cognito.ProviderAttribute.FACEBOOK_EMAIL,
        fullname: cognito.ProviderAttribute.FACEBOOK_NAME,
      },
    });

    // Apple Identity Provider (Sign in with Apple)
    const appleProvider = new cognito.UserPoolIdentityProviderApple(this, 'AppleProvider', {
      userPool: this.userPool,
      clientId: process.env.APPLE_SERVICES_ID || 'placeholder-apple-services-id',
      teamId: process.env.APPLE_TEAM_ID || 'placeholder-apple-team-id',
      keyId: process.env.APPLE_KEY_ID || 'placeholder-apple-key-id',
      privateKey: process.env.APPLE_PRIVATE_KEY || 'placeholder-apple-private-key',
      scopes: ['name', 'email'],
      attributeMapping: {
        email: cognito.ProviderAttribute.APPLE_EMAIL,
        fullname: cognito.ProviderAttribute.APPLE_NAME,
      },
    });

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
        cognito.UserPoolClientIdentityProvider.GOOGLE,
        cognito.UserPoolClientIdentityProvider.FACEBOOK,
        cognito.UserPoolClientIdentityProvider.APPLE,
        cognito.UserPoolClientIdentityProvider.COGNITO,
      ],
    });

    // Ensure providers are created before client
    this.userPoolClient.node.addDependency(googleProvider);
    this.userPoolClient.node.addDependency(facebookProvider);
    this.userPoolClient.node.addDependency(appleProvider);

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
