# Water Resource Mapping & Usage Platform for Farmers

Capstone Project – Humber Polytechnic  
Author: Pengcheng Li

This project is a web application designed to help farmers find nearby water wells, view well information, and record their water usage.  
The system organizes scattered geographic water data and presents it in a simple map-based interface.

---

# Main Features

- View nearby wells on an interactive map
- Search wells in a list
- Check well details
- Record water usage
- Edit or delete usage records
- View basic weather information

---

# Technology Stack

- Next.js
- React
- Google Maps API
- MySQL

Data Source
- GIS well data from Saskatchewan

---

# How the System Works

The system collects raw GIS well data and processes it into a structured database.

Data pipeline:

GIS Data  
→ Data Processing  
→ MySQL Database  
→ Map Visualization

This allows farmers to easily explore water resources on a map.

---

# Running the Project Locally

## 1. Clone the repository

```bash
git clone https://github.com/N01715807/Location-based-mapping-application/tree/main/mapping-app
cd your-repository
```
## 2. Install dependencies
```bash
npm install
```
## 3. Setup environment variables
```bash
Create a .env.local file in the project root.
Example:
MYSQL_HOST=localhost
MYSQL_USER=root
MYSQL_PASSWORD=yourpassword
MYSQL_DATABASE=water_app

GOOGLE_MAPS_API_KEY=your_google_maps_key
```

## 4. Run the development server
```bash
npm run dev
```

## Then open:
```bash
http://localhost:3000
```