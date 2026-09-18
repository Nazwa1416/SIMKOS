const getPool = require('./_db');

async function getData() {
  const db = getPool();

  const [settingsRows] = await db.query(
    'SELECT * FROM settings WHERE id = 1 LIMIT 1'
  );

  const [rooms] = await db.query(
    'SELECT * FROM rooms ORDER BY nomor'
  );

  const [tenants] = await db.query(
    'SELECT * FROM tenants ORDER BY nama'
  );

  const [payments] = await db.query(
    'SELECT * FROM payments ORDER BY bulan DESC'
  );

  const settings = settingsRows[0] || null;

  for (const room of rooms) {
    if (typeof room.fasilitas === 'string') {
      try {
        room.fasilitas = JSON.parse(room.fasilitas);
      } catch {
        room.fasilitas = [];
      }
    }
  }

  return {
    settings,
    rooms,
    tenants,
    payments
  };
}

async function saveData(data) {
  const db = getPool();

  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const settings = data.settings || {};

    await connection.query(
      `
      INSERT INTO settings
      (id, namaKos, alamat, telepon, jatuhTempo, username, password)
      VALUES (1, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        namaKos = VALUES(namaKos),
        alamat = VALUES(alamat),
        telepon = VALUES(telepon),
        jatuhTempo = VALUES(jatuhTempo),
        username = VALUES(username),
        password = VALUES(password)
      `,
      [
        settings.namaKos || '',
        settings.alamat || '',
        settings.telepon || '',
        Number(settings.jatuhTempo) || 5,
        settings.username || 'admin',
        settings.password || 'admin123'
      ]
    );

    await connection.query('DELETE FROM payments');
    await connection.query('DELETE FROM tenants');
    await connection.query('DELETE FROM rooms');

    const rooms = Array.isArray(data.rooms) ? data.rooms : [];

    for (const room of rooms) {
      await connection.query(
        `
        INSERT INTO rooms
        (id, nomor, tipe, harga, fasilitas, status)
        VALUES (?, ?, ?, ?, ?, ?)
        `,
        [
          room.id,
          room.nomor || '',
          room.tipe || '',
          Number(room.harga) || 0,
          JSON.stringify(room.fasilitas || []),
          room.status || 'Kosong'
        ]
      );
    }

    const tenants = Array.isArray(data.tenants) ? data.tenants : [];

    for (const tenant of tenants) {
      await connection.query(
        `
        INSERT INTO tenants
        (id, nama, hp, jk, roomId, tglMasuk, tglKeluar, alamat, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          tenant.id,
          tenant.nama || '',
          tenant.hp || null,
          tenant.jk || null,
          tenant.roomId || null,
          tenant.tglMasuk || null,
          tenant.tglKeluar || null,
          tenant.alamat || null,
          tenant.status || 'Aktif'
        ]
      );
    }

    const payments = Array.isArray(data.payments) ? data.payments : [];

    for (const payment of payments) {
      await connection.query(
        `
        INSERT INTO payments
        (id, tenantId, roomId, bulan, jatuhTempo, tagihan, dibayar, tglBayar)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          payment.id,
          payment.tenantId || null,
          payment.roomId || null,
          payment.bulan || '',
          payment.jatuhTempo || null,
          Number(payment.tagihan) || 0,
          Number(payment.dibayar) || 0,
          payment.tglBayar || null
        ]
      );
    }

    await connection.commit();

    return {
      success: true,
      message: 'Data berhasil disimpan'
    };

  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

module.exports = async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const data = await getData();
      return res.status(200).json(data);
    }

    if (req.method === 'POST') {
      const result = await saveData(req.body);
      return res.status(200).json(result);
    }

    res.setHeader('Allow', ['GET', 'POST']);
    return res.status(405).json({
      error: 'Method tidak diizinkan'
    });

  } catch (error) {
    console.error('API ERROR:', error);

    return res.status(500).json({
      error: 'Gagal mengakses database',
      detail: error.message
    });
  }
};