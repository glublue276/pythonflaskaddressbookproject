# Address Book Website

This is a basic address book website built with Python, Flask, and MongoDB.
It supports:

- Add a record
- Update a record
- Delete a record
- Search by keyword
- Search by first name
- Search by last name
- Search by address
- Add custom fields to a record
- Update custom fields in a record
- Delete fields from a record

## System design

### 1. Architecture

The app uses a simple 3-layer design:

1. Client layer:
   A server-rendered HTML page with JavaScript that calls backend APIs.
2. Application layer:
   A Flask application that handles validation, search, CRUD operations, and
   field-level updates.
3. Data layer:
   MongoDB stores each contact document and supports indexed search on the most
   common fields.

### 2. Data model

Each contact is stored as one MongoDB document:

```json
{
  "_id": "ObjectId",
  "first_name": "John",
  "last_name": "Doe",
  "address": "12 Main St, Seattle",
  "phone_number": "111-222-3333",
  "extra_fields": {
    "company": "Acme",
    "notes": "Met at conference"
  },
  "searchable_text": "john doe 12 main st seattle 111-222-3333 company acme notes met at conference"
}
```

### 3. Search design

- `first_name`, `last_name`, and `address` are queried directly with
  case-insensitive regex.
- `keyword` search uses a precomputed `searchable_text` field.
- The `searchable_text` field is rebuilt whenever a record or field changes.

This keeps the design simple while still supporting both fixed fields and
dynamic extra fields.

### 4. API design

#### Contact APIs

- `GET /api/contacts`
  Query params: `keyword`, `first_name`, `last_name`, `address`
- `POST /api/contacts`
  Create a record
- `PUT /api/contacts/<id>`
  Replace the full record
- `PATCH /api/contacts/<id>`
  Update selected core fields and merge extra fields
- `DELETE /api/contacts/<id>`
  Delete a record

#### Field APIs

- `PATCH /api/contacts/<id>/fields`
  Add or update one field
- `DELETE /api/contacts/<id>/fields/<field_name>`
  Delete a field from the record

### 5. Why MongoDB fits here

- Contacts are document-shaped and map naturally to MongoDB documents.
- Custom per-contact fields are easy to store under `extra_fields`.
- The schema can evolve without a migration-heavy relational model.

## Project structure

```text
.
|-- app.py
|-- package.json
|-- playwright.config.js
|-- requirements.txt
|-- tests/
|   `-- e2e/
|       |-- ui-tests/
|       |   `-- address-book.spec.js
|       `-- unit-tests/
|           `-- test_app.py
|-- templates/
|   `-- index.html
`-- static/
    `-- style.css
```

## Run locally

### 1. Start MongoDB

Make sure MongoDB is running locally at:

```bash
mongodb://localhost:27017/
```

If needed, set a custom connection string:

```bash
export MONGO_URI="mongodb://localhost:27017/"
```

### 2. Create a virtual environment

```bash
python3 -m venv .venv
source .venv/bin/activate
```

### 3. Install dependencies

```bash
pip install -r requirements.txt
```

### 4. Run the app

```bash
python app.py
```

Then open:

```text
http://127.0.0.1:5000
```

## Notes

- Deleting a core field sets it to an empty string instead of physically
  removing the key.
- Deleting a custom field removes it from `extra_fields`.
- This is a basic starter app; for production you would typically add input
  validation, pagination, authentication, structured logging, and better search
  indexing.

## Production and AWS deployment

### Production runtime

Use `gunicorn` instead of Flask's development server:

```bash
gunicorn --bind 0.0.0.0:5000 app:app
```

The app also exposes a health endpoint:

```text
/health
```

For database readiness checks, use:

```text
/ready
```

### AWS ECS deployment

The supported deployment path is the GitHub Actions workflow:

```text
.github/workflows/deploy-ecs-fargate.yml
```

It keeps the existing AWS setup: the same ECR repository, task execution role,
MongoDB secret, Docker image, and `/health` endpoint. The workflow provisions a
standard ECS Fargate service behind an Application Load Balancer instead of ECS
Express managed ingress.

Required repository variables:

```text
AWS_REGION
ECR_REPOSITORY
MONGO_URI_SECRET_ARN
ECS_EXPRESS_EXECUTION_ROLE_ARN
ECS_EXPRESS_SERVICE_NAME
```

`MONGO_URI_SECRET_ARN` may point either to a raw MongoDB URI secret string or
to an AWS Secrets Manager JSON secret with a `MONGO_URI` key. The workflow
detects the JSON form and passes only that key to the container.

Optional repository variables:

```text
ECS_CLUSTER_NAME
ECS_SERVICE_NAME
ECS_TASK_EXECUTION_ROLE_ARN
ECS_TASK_ROLE_ARN
ECS_VPC_ID
ECS_SUBNET_IDS
```

If the optional ECS values are omitted, the workflow uses the default cluster,
default VPC subnets, and a Fargate service name derived from the existing ECS
Express service name.

### Sandbox-style container test

Build the container locally:

```bash
docker build -t python-address-book .
```

Run it against a reachable MongoDB instance:

```bash
docker run --rm -p 5000:5000 \
  -e MONGO_URI="mongodb://host.docker.internal:27017/" \
  -e MONGO_DB_NAME="address_book" \
  python-address-book
```

Then open:

```text
http://127.0.0.1:5000
```

## Playwright smoke tests

Install the JavaScript test dependency:

```bash
npm install
```

Install the Playwright browser:

```bash
npx playwright install chromium
```

Run the smoke suite:

```bash
npm run test:e2e
```

Run the smoke suite with verbose Playwright API logs:

```bash
npm run test:e2e:debug
```

Playwright now targets your already-running local app on port `5000`, so start
the Flask app before you execute the tests.

## Consistent local test workflow

You can also use the included `Makefile`:

```bash
make test-unit
make test-ui
make test-ui-debug
make test
```

If a Playwright run gets stuck or leaves a stale process behind:

```bash
make clean-ui
```

If pytest cache permissions ever get weird again:

```bash
make reset-pytest-cache
```

Run the Python unit tests:

```bash
pytest tests/e2e/unit-tests/test_app.py
```

### AWS ECS Express Mode deployment

This repository is ready to deploy as a containerized service to Amazon ECS
Express Mode.

#### Required AWS setup

Before you run the deployment workflow, set up:

1. An Amazon ECR repository for the application image.
2. A GitHub OIDC IAM role that GitHub Actions can assume.
3. Repository variables in GitHub:
   - `AWS_REGION`
   - `ECR_REPOSITORY`
   - `ECS_EXPRESS_SERVICE_NAME`
   - `ECS_EXPRESS_SERVICE_ARN`
   - `ECS_EXPRESS_EXECUTION_ROLE_ARN`
   - `ECS_EXPRESS_INFRASTRUCTURE_ROLE_ARN`
   - `MONGO_URI_SECRET_ARN`
4. Repository secret in GitHub:
   - `AWS_ROLE_TO_ASSUME`

The workflow publishes both a commit-based image tag and a `latest` tag. It
then either creates an ECS Express service or updates an existing one,
depending on whether `ECS_EXPRESS_SERVICE_ARN` is already set in the
repository variables.

For ECS Express Mode, AWS documents two service roles:

- a task execution role with `AmazonECSTaskExecutionRolePolicy`
- an infrastructure role with
  `AmazonECSInfrastructureRoleforExpressGatewayServices`

#### Deployment workflow

The repository includes a manual GitHub Actions workflow:

```text
.github/workflows/deploy-ecs-express.yml
```

Run it from the GitHub Actions tab with `workflow_dispatch`.

What it does:

1. Assumes your AWS role through GitHub OIDC.
2. Ensures the target ECR repository exists.
3. Builds and pushes the Docker image to ECR.
4. Creates or updates an Amazon ECS Express Mode service.
5. Polls the deployed `/health` endpoint until the app is healthy.
6. Uploads a small deployment summary artifact to the workflow run.

You can optionally provide an `image_tag` input when you manually launch the
workflow. If you leave it blank, the workflow uses the current commit SHA.

#### ECS Express runtime settings

The deployed ECS Express service should also include:

1. A MongoDB Atlas cluster or another reachable MongoDB deployment.
2. Runtime environment variables:

```text
MONGO_URI=mongodb+srv://...
MONGO_DB_NAME=address_book
MONGO_COLLECTION=contacts
PORT=5000
```

3. A health check path of:

```text
/health
```

The `/health` route only verifies that the Flask container is serving traffic.
The `/ready` route verifies MongoDB connectivity and returns an error if the
database is not reachable.

### ECS Express notes

On the first deployment, leave `ECS_EXPRESS_SERVICE_ARN` empty in GitHub
variables. The workflow will create the ECS Express service using:

- `ECS_EXPRESS_SERVICE_NAME`
- `ECS_EXPRESS_EXECUTION_ROLE_ARN`
- `ECS_EXPRESS_INFRASTRUCTURE_ROLE_ARN`

After the first successful create, copy the resulting ECS Express service ARN
into `ECS_EXPRESS_SERVICE_ARN` in GitHub variables so later runs update the
same service.

The MongoDB connection string should be stored in AWS Secrets Manager or SSM
Parameter Store, and `MONGO_URI_SECRET_ARN` should point to that secret or
parameter ARN. If the AWS Secrets Manager value is JSON, store the connection
string under a `MONGO_URI` key.
### Example ECR flow

```bash
aws ecr create-repository --repository-name python-address-book
```

```bash
aws ecr get-login-password --region <aws-region> | docker login --username AWS --password-stdin <account-id>.dkr.ecr.<aws-region>.amazonaws.com
```

```bash
docker build -t python-address-book .
docker tag python-address-book:latest <account-id>.dkr.ecr.<aws-region>.amazonaws.com/python-address-book:latest
docker push <account-id>.dkr.ecr.<aws-region>.amazonaws.com/python-address-book:latest
```

From there, create or update the ECS Express Mode service with the image and
runtime settings above.
