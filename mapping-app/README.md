This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

mysql -h 127.0.0.1 -u root

http://10.0.0.79:3000/api/water-resources
http://10.0.0.79:3000/home

WSA Water Wells – Layer Verification
Layer URL
https://gis.wsask.ca/arcgiswa/rest/services/WellsSite/WaterWellsPublic/FeatureServer/0
Verified Layer Properties
Item	Value
objectIdField	OBJECTID
maxRecordCount	30000
Spatial Reference	2151 (latest WKID: 2957)
Important Note
The source layer is NOT in WGS84.
All geometry queries must include:
outSR=4326
Otherwise coordinates will be returned in projected meters and will not display correctly on web maps.
Verification Performed
Confirmed OBJECTID as primary key.
Confirmed maxRecordCount = 30000.
Confirmed Spatial Reference is 2151 (not 4326).

mysql> DESCRIBE water_resources;
+--------------+---------------+------+-----+-------------------+-----------------------------------------------+
| Field        | Type          | Null | Key | Default           | Extra                                         |
+--------------+---------------+------+-----+-------------------+-----------------------------------------------+
| id           | bigint        | NO   | PRI | NULL              | auto_increment                                |
| name         | varchar(255)  | NO   |     | NULL              |                                               |
| type         | varchar(100)  | NO   |     | NULL              |                                               |
| is_available | tinyint       | NO   |     | 1                 |                                               |
| latitude     | decimal(10,7) | YES  |     | NULL              |                                               |
| longitude    | decimal(10,7) | YES  |     | NULL              |                                               |
| is_deleted   | tinyint       | NO   |     | 0                 |                                               |
| deleted_at   | datetime      | YES  |     | NULL              |                                               |
| status       | varchar(50)   | YES  |     | NULL              |                                               |
| created_at   | datetime      | YES  |     | CURRENT_TIMESTAMP | DEFAULT_GENERATED                             |
| updated_at   | datetime      | NO   |     | CURRENT_TIMESTAMP | DEFAULT_GENERATED on update CURRENT_TIMESTAMP |
+--------------+---------------+------+-----+-------------------+-----------------------------------------------+
11 rows in set (0.00 sec)

mysql> DESCRIBE water_resources_source;
+-------------------+--------------+------+-----+-------------------+-------------------+
| Field             | Type         | Null | Key | Default           | Extra             |
+-------------------+--------------+------+-----+-------------------+-------------------+
| id                | bigint       | NO   | PRI | NULL              | auto_increment    |
| source            | varchar(32)  | NO   | MUL | NULL              |                   |
| source_layer      | varchar(128) | NO   |     | NULL              |                   |
| source_objectid   | bigint       | NO   |     | NULL              |                   |
| raw_attributes    | json         | NO   |     | NULL              |                   |
| raw_geometry      | json         | YES  |     | NULL              |                   |
| source_updated_at | datetime     | YES  |     | NULL              |                   |
| first_seen_at     | datetime     | NO   |     | CURRENT_TIMESTAMP | DEFAULT_GENERATED |
| last_seen_at      | datetime     | NO   | MUL | CURRENT_TIMESTAMP | DEFAULT_GENERATED |
| is_deleted        | tinyint      | NO   | MUL | 0                 |                   |
| deleted_at        | datetime     | YES  |     | NULL              |                   |
+-------------------+--------------+------+-----+-------------------+-------------------+
11 rows in set (0.01 sec)

mysql> DESCRIBE sync_jobs;
+--------------+--------------+------+-----+-------------------+-------------------+
| Field        | Type         | Null | Key | Default           | Extra             |
+--------------+--------------+------+-----+-------------------+-------------------+
| id           | bigint       | NO   | PRI | NULL              | auto_increment    |
| source       | varchar(32)  | NO   | MUL | NULL              |                   |
| source_layer | varchar(128) | NO   |     | NULL              |                   |
| status       | varchar(20)  | NO   | MUL | NULL              |                   |
| started_at   | datetime     | NO   |     | CURRENT_TIMESTAMP | DEFAULT_GENERATED |
| finished_at  | datetime     | YES  |     | NULL              |                   |
| stats_json   | json         | YES  |     | NULL              |                   |
| error        | text         | YES  |     | NULL              |                   |
+--------------+--------------+------+-----+-------------------+-------------------+
8 rows in set (0.00 sec)

mysql> DESCRIBE fields;
+------------+--------------+------+-----+-------------------+-----------------------------------------------+
| Field      | Type         | Null | Key | Default           | Extra                                         |
+------------+--------------+------+-----+-------------------+-----------------------------------------------+
| id         | bigint       | NO   | PRI | NULL              | auto_increment                                |
| name       | varchar(255) | NO   | UNI | NULL              |                                               |
| notes      | text         | YES  |     | NULL              |                                               |
| is_deleted | tinyint      | NO   | MUL | 0                 |                                               |
| deleted_at | datetime     | YES  |     | NULL              |                                               |
| created_at | datetime     | NO   |     | CURRENT_TIMESTAMP | DEFAULT_GENERATED                             |
| updated_at | datetime     | NO   |     | CURRENT_TIMESTAMP | DEFAULT_GENERATED on update CURRENT_TIMESTAMP |
+------------+--------------+------+-----+-------------------+-----------------------------------------------+
7 rows in set (0.00 sec)

mysql> DESCRIBE usage_logs;
+-------------------+---------------+------+-----+-------------------+-------------------+
| Field             | Type          | Null | Key | Default           | Extra             |
+-------------------+---------------+------+-----+-------------------+-------------------+
| id                | bigint        | NO   | PRI | NULL              | auto_increment    |
| water_resource_id | bigint        | NO   | MUL | NULL              |                   |
| used_at           | datetime      | NO   | MUL | NULL              |                   |
| field_id          | bigint        | YES  | MUL | NULL              |                   |
| field_name        | varchar(255)  | YES  |     | NULL              |                   |
| amount            | decimal(12,2) | NO   |     | NULL              |                   |
| note              | text          | YES  |     | NULL              |                   |
| is_deleted        | tinyint       | NO   | MUL | 0                 |                   |
| deleted_at        | datetime      | YES  |     | NULL              |                   |
| created_at        | datetime      | NO   |     | CURRENT_TIMESTAMP | DEFAULT_GENERATED |
+-------------------+---------------+------+-----+-------------------+-------------------+
10 rows in set (0.00 sec)
http://10.0.0.79:3000/api/admin/sync/wsa-water-wells

curl -X POST http://localhost:3000/api/admin/sync/wsa-water-wells \
  -H "Content-Type: application/json" \
  -H "x-admin-token: some-long-random-string" \
  -d '{"mode":"full"}'

curl -X POST http://localhost:3000/api/admin/sync/wsa-water-wells \
  -H "Content-Type: application/json" \
  -H "x-admin-token: some-long-random-string" \
  -d '{"mode":"incremental"}'

/api/water-resources?minLat=...&maxLat=...&minLng=...&maxLng=...&limit=2000
