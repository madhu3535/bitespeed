# Bitespeed Backend Task — Identity Reconciliation

##  Live API Endpoint

POST  
https://bitespeed-4xnf.onrender.com/identify

---

## Problem Overview

FluxKart collects customer contact details during checkout.  
Customers may use different email addresses and phone numbers across purchases.

The objective of this task is to:

- Identify whether incoming contact details belong to an existing customer
- Link multiple contact records belonging to the same person
- Maintain a single primary identity per customer
- Return a consolidated response

---

## Database Design

The application uses a relational database table named `Contact`.

### Contact Schema

- `id` — Auto-incremented primary key
- `email` — Optional
- `phoneNumber` — Optional
- `linkedId` — References primary contact if secondary
- `linkPrecedence` — `"primary"` or `"secondary"`
- `createdAt`
- `updatedAt`
- `deletedAt`

### Identity Model

- The **oldest contact** in a group is marked as `"primary"`
- All other linked contacts are marked as `"secondary"`
- Contacts are linked if they share:
  - email OR
  - phoneNumber

---

##  API Specification

### Endpoint

```
POST /identify
```

### Request Body (JSON)

```json
{
  "email": "string (optional)",
  "phoneNumber": "string (optional)"
}
```

At least one of the fields must be provided.

---

##  Response Format

```json
{
  "contact": {
    "primaryContatctId": number,
    "emails": ["string"],
    "phoneNumbers": ["string"],
    "secondaryContactIds": [number]
  }
}
```

### Response Rules

- The oldest contact is always the primary.
- Emails returned are unique.
- Phone numbers returned are unique.
- Primary contact’s email and phone appear first.
- `secondaryContactIds` contains all secondary contact IDs.

---

##  Identity Reconciliation Rules

### 1️. New Contact

If no matching contact exists:
- Create a new primary contact.

---

### 2️. Secondary Contact Creation

If a request matches an existing contact (via email or phone)
AND introduces new information:
- Create a new secondary contact linked to the primary.

Example:

Existing:
- email: lorraine@hillvalley.edu
- phone: 123456

Incoming:
- email: mcfly@hillvalley.edu
- phone: 123456

Result:
- Primary remains unchanged.
- New secondary contact created.

---

### 3️. Primary Merge Case

If a request connects two existing primary contacts:

- The oldest primary remains primary.
- The newer primary becomes secondary.
- All records consolidate under the oldest primary.

This ensures deterministic and stable identity linking.

---

## Technology Stack

- Node.js
- Express.js
- Prisma ORM
- PostgreSQL (Neon)
- Render (Cloud Deployment)

---

## 🚀 Running Locally

### 1️. Clone the repository

```
git clone <your-repo-url>
cd bitespeed-identity
```

### 2️. Install dependencies

```
npm install
```

### 3️. Configure environment variables

Create a `.env` file in the root directory:

```
DATABASE_URL=your_postgres_connection_string
PORT=3000
```

### 4️. Run Prisma migration

```
npx prisma migrate dev
```

### 5️. Start server

```
node src/server.js
```

Server runs at:

```
http://localhost:3000
```

---

## Testing the API

### Using Postman

Method: `POST`  
URL:  
```
https://bitespeed-4xnf.onrender.com/identify
```

Body → Raw → JSON:

```json
{
  "email": "doc@fluxkart.com",
  "phoneNumber": "9990012345"
}
```

---

## Sample Test Cases

### Test 1 — New Contact

```json
{
  "email": "alpha@test.com"
}
```

Creates a new primary contact.

---

### Test 2 — Secondary Creation

```json
{
  "email": "beta@test.com",
  "phoneNumber": "9990012345"
}
```

Creates secondary linked to existing primary.

---

### Test 3 — Merge Case

Step 1:
```json
{ "email": "merge1@test.com" }
```

Step 2:
```json
{ "phoneNumber": "8888888888" }
```

Step 3:
```json
{
  "email": "merge1@test.com",
  "phoneNumber": "8888888888"
}
```

Oldest primary remains. Newer becomes secondary.

---

## Data Integrity

- All operations use database transactions.
- Oldest primary is always selected deterministically.
- Duplicate emails and phone numbers are filtered in response.
- Repeated identical requests are idempotent.
- Merge logic ensures consistent identity graph.

---

## Project Structure

```
bitespeed-identity/
│
├── prisma/
│   └── schema.prisma
│
├── src/
│   ├── server.js
│   ├── routes.js
│   ├── controller.js
│   └── service.js
│
├── package.json
├── .env
└── README.md
```

---

## Current Status

- Backend implemented
- Identity reconciliation logic complete
- Handles primary-to-secondary conversion
- Handles merge cases
- Deployed successfully
- Public endpoint accessible

---

Thank you for reviewing this submission.
