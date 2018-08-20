const sqlite3 = require('sqlite3').verbose();

let db = new sqlite3.Database(':memory:');

db.getAsync = function (sql) {
    var _this = this;
    return new Promise(function (resolve, reject) {
        _this.get(sql, function (err, row) {
            if (err)
                reject(err);
            else
                resolve(row);
        });
    });
};

db.allAsync = function (sql) {
    var _this = this;
    return new Promise(function (resolve, reject) {
        _this.all(sql, function (err, rows) {
            if (err)
                reject(err);
            else
                resolve(rows);
        });
    });
};

db.runAsync = function (sql) {
    var _this = this;
    return new Promise(function (resolve, reject) {
        _this.run(sql, function(err) {
            if (err)
                reject(err);
            else
                resolve();
        });
    })
};
//
// async function data() {
//   try {
//     await db.runAsync(`CREATE TABLE IF NOT EXISTS User (
//       id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
//       access_token varchar(30),
//       hydro_address_id varchar(30),
//       address varchar(30),
//       private_key varchar(30)
//     )`);
//     await db.runAsync(`INSERT INTO User VALUES (?, ?, ?, ?, ?)`, [1, 'abc', '3', 'waegaw325', '32525sa'])
//     const logs = await db.getAsync(`SELECT * FROM User`)
//     console.log('logs',logs)
//     // db.close();
//   }
//   catch (err) {
//     console.log('err',err)
//   }
// }
// data()

db.serialize(function() {
  db.run(`CREATE TABLE IF NOT EXISTS User (
    id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    access_token varchar(30),
    hydro_address_id varchar(30),
    address varchar(30),
    private_key varchar(30)
  )`);
  db.run(`INSERT INTO User VALUES (?, ?, ?, ?, ?)`, [1, 'abc', '3', 'waegaw325', '32525sa'])
  db.get(`SELECT * FROM User`, function(err, row){
    console.log('row',row)
  })
})
