package middleware

import (
	"github.com/aws/aws-lambda-go/events"
)

// AddCORSHeaders adds CORS headers to the response
func AddCORSHeaders(response events.APIGatewayProxyResponse, allowedOrigins string) events.APIGatewayProxyResponse {
	if response.Headers == nil {
		response.Headers = make(map[string]string)
	}

	response.Headers["Access-Control-Allow-Origin"] = allowedOrigins
	response.Headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"
	response.Headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization, X-Requested-With"
	response.Headers["Access-Control-Max-Age"] = "3600"

	return response
}

// HandlePreflight handles OPTIONS preflight requests
func HandlePreflight(allowedOrigins string) events.APIGatewayProxyResponse {
	return events.APIGatewayProxyResponse{
		StatusCode: 200,
		Headers: map[string]string{
			"Access-Control-Allow-Origin":  allowedOrigins,
			"Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
			"Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With",
			"Access-Control-Max-Age":       "3600",
		},
		Body: "",
	}
}
