# Read the account ID associated with the AWS credentials used by Terraform.
# Include it in the bucket name to reduce naming collisions across accounts.
data "aws_caller_identity" "current" {}

# Create the bucket used to store evaluation evidence.
# Configure ownership, encryption, versioning, and retention separately.
resource "aws_s3_bucket" "evaluation_evidence" {
  bucket = "${var.environment}-evaluation-evidence-${data.aws_caller_identity.current.account_id}"

  # Apply the project's resource tags to the evidence bucket.
  # Include project and environment tags through the module inputs.
  tags = var.tags
}

# Block public access through ACLs and bucket policies.
# Keep all four protections enabled for the evidence bucket.
resource "aws_s3_bucket_public_access_block" "evaluation_evidence" {
  bucket = aws_s3_bucket.evaluation_evidence.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Enable versioning so overwriting evidence preserves earlier object versions.
# The lifecycle rule below removes both current and older versions over time.
resource "aws_s3_bucket_versioning" "evaluation_evidence" {
  bucket = aws_s3_bucket.evaluation_evidence.id

  versioning_configuration {
    status = "Enabled"
  }
}

# Expire evidence throughout the bucket after the configured number of days.
# Also delete older versions after they have been noncurrent for that long.
resource "aws_s3_bucket_lifecycle_configuration" "evaluation_evidence" {
  bucket = aws_s3_bucket.evaluation_evidence.id

  rule {
    id     = "expire-evaluation-evidence"
    status = "Enabled"

    # An empty filter applies the rule to every object in this evidence bucket.
    filter {}

    # Expire the current version after the configured number of days.
    # In a versioned bucket, S3 replaces it with a delete marker.
    expiration {
      days = var.s3_retention_days
    }

    # Delete an older version after it has been noncurrent for the configured period.
    # This prevents previous versions from accumulating indefinitely.
    noncurrent_version_expiration {
      noncurrent_days = var.s3_retention_days
    }
  }

  # Enable versioning before configuring expiration of noncurrent versions.
  depends_on = [aws_s3_bucket_versioning.evaluation_evidence]
}

# Give the bucket owner ownership of every uploaded object.
# Disable ACL-based permissions so access is controlled through policies.
resource "aws_s3_bucket_ownership_controls" "evaluation_evidence" {
  bucket = aws_s3_bucket.evaluation_evidence.id

  rule {
    object_ownership = "BucketOwnerEnforced"
  }
}

# Explicitly encrypt new objects with Amazon S3-managed keys.
# AES256 selects SSE-S3 as the bucket's default encryption.
resource "aws_s3_bucket_server_side_encryption_configuration" "evaluation_evidence_sse" {
  bucket = aws_s3_bucket.evaluation_evidence.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# Build a bucket policy that denies requests sent without HTTPS.
# Cover operations on both the bucket itself and its objects.
data "aws_iam_policy_document" "enforce_https" {
  statement {
    sid    = "EnforceHTTPSRequestsOnly"
    effect = "Deny"

    principals {
      type        = "*"
      identifiers = ["*"]
    }

    actions = ["s3:*"]

    resources = [
      aws_s3_bucket.evaluation_evidence.arn,
      "${aws_s3_bucket.evaluation_evidence.arn}/*"
    ]

    # Deny the request when AWS reports that secure transport is false.
    # This applies regardless of any separate Allow permission.
    condition {
      test     = "Bool"
      variable = "aws:SecureTransport"
      values   = ["false"]
    }
  }
}

# Attach the HTTPS-only policy document to the evidence bucket.
# The policy takes effect when Terraform creates this resource.
resource "aws_s3_bucket_policy" "attach_enforce_https" {
  bucket = aws_s3_bucket.evaluation_evidence.id
  policy = data.aws_iam_policy_document.enforce_https.json
}
