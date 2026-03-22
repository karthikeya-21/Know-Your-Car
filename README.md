# Know Your Car 🚗

A web app to browse, add, and manage car information — built with Node.js, Express, EJS, and MongoDB.

## Features

- Add and update car listings with full specifications
- Search cars by name or filter by brand
- Manage car brands with logos
- About us section

## Setup

### 1. Clone the repo
```bash
git clone https://github.com/your-username/know-your-car.git
cd know-your-car
```

### 2. Install dependencies
```bash
npm install
```

### 3. Configure environment variables
```bash
cp .env.example .env
```
Then edit `.env` and fill in your MongoDB connection string:
```
MONGO_URI=mongodb+srv://<username>:<password>@cluster0.xxxxxx.mongodb.net/?retryWrites=true&w=majority
PORT=8000
```

### 4. Run the app
```bash
# Development (with nodemon)
npm start

# Production
npm run start:prod
```

The server will start at [http://localhost:8000](http://localhost:8000).

## API Routes

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/` | List all cars |
| GET | `/insert` | Show add car form |
| POST | `/insert` | Add a new car |
| GET | `/update/:name` | Show update form for a car |
| POST | `/update/:name` | Update a car |
| GET | `/name/:name` | Search cars by name |
| GET | `/brand/:brand` | Filter cars by brand |
| GET | `/brand` | Show add brand form |
| POST | `/insertbrand` | Add a new brand |
| GET | `/getbrands` | List all brands |
| GET | `/about_us` | About us data |

## License

MIT
