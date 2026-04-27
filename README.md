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
|-- requirements.txt
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
