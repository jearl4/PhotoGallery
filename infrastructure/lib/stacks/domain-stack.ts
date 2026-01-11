import * as cdk from 'aws-cdk-lib';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import { Construct } from 'constructs';

interface DomainStackProps extends cdk.StackProps {
  stage: string;
  baseDomain: string; // e.g., "photographergallery.com"
  hostedZoneId?: string; // Optional: provide if zone already exists
}

export class DomainStack extends cdk.Stack {
  public readonly hostedZone: route53.IHostedZone;
  public readonly wildcardCertificate: acm.ICertificate;
  public readonly baseDomain: string;

  constructor(scope: Construct, id: string, props: DomainStackProps) {
    super(scope, id, props);

    this.baseDomain = props.baseDomain;

    // Import or create hosted zone
    if (props.hostedZoneId) {
      // Use existing hosted zone
      this.hostedZone = route53.HostedZone.fromHostedZoneAttributes(this, 'HostedZone', {
        hostedZoneId: props.hostedZoneId,
        zoneName: props.baseDomain,
      });
    } else {
      // Look up existing hosted zone by domain name
      this.hostedZone = route53.HostedZone.fromLookup(this, 'HostedZone', {
        domainName: props.baseDomain,
      });
    }

    // Create wildcard certificate for subdomains
    // This certificate covers *.baseDomain and the apex domain
    this.wildcardCertificate = new acm.Certificate(this, 'WildcardCertificate', {
      domainName: props.baseDomain,
      subjectAlternativeNames: [`*.${props.baseDomain}`],
      validation: acm.CertificateValidation.fromDns(this.hostedZone),
    });

    // Outputs
    new cdk.CfnOutput(this, 'HostedZoneId', {
      value: this.hostedZone.hostedZoneId,
      exportName: `HostedZoneId-${props.stage}`,
      description: 'Route53 Hosted Zone ID',
    });

    new cdk.CfnOutput(this, 'WildcardCertificateArn', {
      value: this.wildcardCertificate.certificateArn,
      exportName: `WildcardCertificateArn-${props.stage}`,
      description: 'ACM Wildcard Certificate ARN',
    });

    new cdk.CfnOutput(this, 'BaseDomain', {
      value: props.baseDomain,
      exportName: `BaseDomain-${props.stage}`,
      description: 'Base domain for the application',
    });
  }
}
