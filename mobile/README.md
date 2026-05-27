# Address Book Mobile

This is an Expo React Native mobile client for the Flask and MongoDB address
book API in the repository root.

## Features

- List contacts
- Search by keyword, first name, last name, or address
- Create contacts
- Edit contacts
- Delete contacts
- Add and remove custom fields
- Check backend readiness
- Override the API base URL from the app screen

## Run locally

Install dependencies:

```bash
cd mobile
npm install
```

Start Expo:

```bash
npm start
```

The app defaults to the deployed Fargate API:

```text
http://python-address-book-fargate-alb-2037795374.us-east-2.elb.amazonaws.com
```

To point at a local Flask server, either edit the API URL field in the app or
start Expo with:

```bash
EXPO_PUBLIC_API_BASE_URL=http://127.0.0.1:5000 npm start
```

For Android emulators, use `http://10.0.2.2:5000` for a Flask server running on
your host machine.
