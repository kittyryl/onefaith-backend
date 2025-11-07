/**
 * split_bike_bigbike_prices.js
 *
 * One-time maintenance script to split any combined Bike/Big Bike vehicle_type
 * entries in carwash_service_prices into two separate rows: 'BIKE' and 'BIG BIKE'.
 *
 * Usage (from backend dir):
 *   node split_bike_bigbike_prices.js
 */

const { pool } = require("./db");

async function main() {
  const client = await pool.connect();
  try {
    console.log("Scanning for combined Bike/Big Bike price rows...\n");

    const { rows: combined } = await client.query(
      `SELECT id, service_id, vehicle_type, price, is_active
         FROM carwash_service_prices
        WHERE LOWER(vehicle_type) ~ $1`,
      [
        // looks for rows that contain both 'bike' and 'big' and a separator like '/', '&', 'and', ','
        "(?i)(?=.*bike)(?=.*big)(?=.*(/|&|,| and ))",
      ]
    );

    if (combined.length === 0) {
      console.log("No combined Bike/Big Bike rows found. Nothing to do.");
      return;
    }

    console.log(`Found ${combined.length} combined row(s). Applying split...`);

    for (const row of combined) {
      const { id, service_id, price, vehicle_type } = row;

      // Normalize target types
      const bikeType = "BIKE";
      const bigBikeType = "BIG BIKE";

      await client.query("BEGIN");
      try {
        // Insert BIKE if missing
        const { rows: existingBike } = await client.query(
          `SELECT id FROM carwash_service_prices WHERE service_id = $1 AND UPPER(vehicle_type) = $2`,
          [service_id, bikeType]
        );
        if (existingBike.length === 0) {
          await client.query(
            `INSERT INTO carwash_service_prices (service_id, vehicle_type, price, is_active)
             VALUES ($1, $2, $3, TRUE)`,
            [service_id, bikeType, price]
          );
          console.log(
            `+ Inserted BIKE for service_id=${service_id} (price=${price})`
          );
        } else {
          console.log(`• BIKE already exists for service_id=${service_id}`);
        }

        // Insert BIG BIKE if missing
        const { rows: existingBig } = await client.query(
          `SELECT id FROM carwash_service_prices WHERE service_id = $1 AND UPPER(vehicle_type) = $2`,
          [service_id, bigBikeType]
        );
        if (existingBig.length === 0) {
          await client.query(
            `INSERT INTO carwash_service_prices (service_id, vehicle_type, price, is_active)
             VALUES ($1, $2, $3, TRUE)`,
            [service_id, bigBikeType, price]
          );
          console.log(
            `+ Inserted BIG BIKE for service_id=${service_id} (price=${price})`
          );
        } else {
          console.log(`• BIG BIKE already exists for service_id=${service_id}`);
        }

        // Remove the combined row to avoid confusion in POS
        await client.query(`DELETE FROM carwash_service_prices WHERE id = $1`, [
          id,
        ]);
        console.log(
          `- Deleted combined row id=${id} (${vehicle_type}) for service_id=${service_id}`
        );

        await client.query("COMMIT");
      } catch (e) {
        await client.query("ROLLBACK");
        console.error(
          `Failed to split for service_id=${service_id}, vehicle_type='${vehicle_type}':`,
          e.message
        );
      }
    }

    console.log(
      "\nDone. You can refresh the POS; Bike and Big Bike will appear separately."
    );
  } finally {
    client.release();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
