// Development environment - for local testing without backend
export const environment = {
  production: false,
  // Mock API - will return 404s, but allows testing UI locally
  apiUrl: 'http://localhost:3000/api/v1',
  cdnUrl: 'https://d1fm1x228as24o.cloudfront.net',

  // For local testing, you can use these placeholder values
  // The app will work without actual Cognito, but login won't function
  cognitoUserPoolId: 'us-east-1_XXXXXXXXX',
  cognitoClientId: 'your-client-id-here',
  cognitoRegion: 'us-east-1',
  cognitoDomain: 'your-cognito-domain',
};
