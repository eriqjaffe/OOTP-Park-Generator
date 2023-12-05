// main.js

// Modules to control application life and create native browser window
const {
  app,
  BrowserWindow,
  dialog,
  Menu,
  shell,
  ipcMain,
} = require("electron");
const path = require("path");
const fs = require("fs");
const initSqlJs = require("sql.js/dist/sql-wasm.js");
const filebuffer = fs.readFileSync(
  path.join(app.getAppPath(), "db", "data.sqlite")
);
const Jimp = require("jimp");
const archiver = require("archiver");
const isMac = process.platform === "darwin";
const os = require("os");
const tempDir = os.tmpdir();
const increment = require("add-filename-increment");
const Store = require("electron-store");
const admzip = require('adm-zip');

const store = new Store();

let db;

initSqlJs().then(function (SQL) {
  db = new SQL.Database(filebuffer);
});

ipcMain.on("get-countries", (event, arg) => {
  let output = [];
  output.push("United States of America");
  db.each(
    'SELECT distinct Country from weather WHERE Country <> "United States of America" order by Country asc',
    function (row) {
      output.push(row.Country);
    }
  );
  event.sender.send("get-countries-response", JSON.stringify(output));
});

ipcMain.on("get-states", (event, arg) => {
  let result = db.exec(
    'SELECT count(State) as count from weather where Country = "' +
      arg.country +
      '"  and length(State) > 0'
  );
  let count = parseInt(result[0].values[0][0]);
  if (count < 1) {
    event.sender.send("get-states-response", { count: count, states: null });
  } else {
    let output = [];
    db.each(
      'SELECT distinct State from weather WHERE Country = "' +
        arg.country +
        '" order by Country asc',
      function (row) {
        output.push(row.State);
      }
    );
    event.sender.send("get-states-response", {
      count: count,
      states: JSON.stringify(output),
    });
  }
});

ipcMain.on("get-cities", (event, arg) => {
  let output = [];
  if (arg.state == null) {
    db.each(
      'SELECT distinct City from weather WHERE Country = "' +
        arg.country +
        '" order by City asc',
      function (row) {
        output.push(row.City);
      }
    );
  } else {
    db.each(
      'SELECT distinct City from weather WHERE Country = "' +
        arg.country +
        '" and State = "' +
        arg.state +
        '" order by City asc',
      function (row) {
        output.push(row.City);
      }
    );
  }
  event.sender.send("get-cities-response", JSON.stringify(output));
});

ipcMain.on("get-weather", (event, arg) => {
  let output = [];
  let sql;
  if (arg.state == null) {
    sql =
      'select * from weather where City = "' +
      arg.city +
      '" and Country = "' +
      arg.country +
      '"';
  } else {
    sql =
      'select * from weather where City = "' +
      arg.city +
      '" and State = "' +
      arg.state +
      '" and Country = "' +
      arg.country +
      '"';
  }
  db.each(sql, function (row) {
    output.push(row);
  });
  event.sender.send("get-weather-response", output);
});

ipcMain.on("random-park-name", (event, arg) => {
  let sql, sql2, output;
  let start = getRandomIntInclusive(5, 15);
  if (start < 11) {
    sql =
      "SELECT a.name, b.parkType FROM parkNames a inner join parkType b ORDER BY RANDOM() LIMIT 1";
    db.each(sql, function (row) {
      output = row.name + " " + row.parkType;
    });
    if (start == 6) {
      sql2 =
        "SELECT a.streetName, b.streetType FROM streetNames a inner join streetType b ORDER BY RANDOM() LIMIT 1";
      db.each(sql2, function (row) {
        output += " at " + row.streetName + " " + row.streetType;
      });
    }
  } else {
    sql =
      "SELECT a.streetName, b.streetType, c.parkType FROM streetNames a inner join streetType b inner join parkType c ORDER BY RANDOM() LIMIT 1";
    db.each(sql, function (row) {
      output = row.streetName + " " + row.streetType + " " + row.parkType;
    });
  }
  event.sender.send("random-park-name-response", output);
});

ipcMain.on("random-park", (event, arg) => {
  let sql, sql2, output, parkName, city;
  let cities = [];
  let states = [];
  let countries = [];
  let start = getRandomIntInclusive(5, 15);
  if (start < 11) {
    sql =
      "SELECT a.name, b.parkType FROM parkNames a inner join parkType b ORDER BY RANDOM() LIMIT 1";
    db.each(sql, function (row) {
      parkName = row.name + " " + row.parkType;
    });
    if (start == 6) {
      sql2 =
        "SELECT a.streetName, b.streetType FROM streetNames a inner join streetType b ORDER BY RANDOM() LIMIT 1";
      db.each(sql2, function (row) {
        parkName += " at " + row.streetName + " " + row.streetType;
      });
    }
  } else {
    sql =
      "SELECT a.streetName, b.streetType, c.parkType FROM streetNames a inner join streetType b inner join parkType c ORDER BY RANDOM() LIMIT 1";
    db.each(sql, function (row) {
      parkName = row.streetName + " " + row.streetType + " " + row.parkType;
    });
  }
  db.each(
    'SELECT * FROM weather where Country = "United States of America" ORDER BY RANDOM() LIMIT 1',
    function (row) {
      city = row;
    }
  );
  db.each(
    'SELECT distinct Country from weather WHERE Country <> "United States of America" order by Country asc',
    function (row) {
      countries.push(row.Country);
    }
  );
  db.each(
    'SELECT distinct State from weather WHERE Country = "United States of America" order by State asc',
    function (row) {
      states.push(row.State);
    }
  );
  db.each(
    'SELECT distinct City from weather WHERE Country = "United States of America" and State = "' +
      city.State +
      '" order by City asc',
    function (row) {
      cities.push(row.City);
    }
  );

  event.sender.send("random-park-response", {
    parkName: parkName,
    city: city,
    countries: countries,
    states: states,
    cities: cities,
  });
});

function getRandomIntInclusive(min, max) {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min + 1) + min); //The maximum is inclusive and the minimum is inclusive
}

ipcMain.on("calculate-factors", (event, arg) => {
  let ParkType = arg.ballparkType;
  let SurfaceType = arg.ballparkSurface;
  let Surface = 0;
  let FoulArea = parseInt(arg.ballparkFoulArea);
  let Altitude = parseInt(arg.ballparkAltitude);
  let LL = parseInt(arg.leftLine);
  let LF = parseInt(arg.leftField);
  let LC = parseInt(arg.leftCenter);
  let CF = parseInt(arg.centerField);
  let RC = parseInt(arg.rightCenter);
  let RF = parseInt(arg.rightField);
  let RL = parseInt(arg.rightLine);
  let LLW = parseInt(arg.leftLineWall);
  let dLLW = LLW > 11 ? LLW : 11;
  let LFW = parseInt(arg.leftFieldWall);
  let dLFW = LFW > 11 ? LFW : 11;
  let LCW = parseInt(arg.leftCenterWall);
  let dLCW = LCW > 11 ? LCW : 11;
  let CFW = parseInt(arg.centerFieldWall);
  let dCFW = CFW > 11 ? CFW : 11;
  let RCW = parseInt(arg.rightCenterWall);
  let dRCW = RCW > 11 ? RCW : 11;
  let RFW = parseInt(arg.rightFieldWall);
  let dRFW = RFW > 11 ? RFW : 11;
  let RLW = parseInt(arg.rightLineWall);
  let dRLW = RLW > 11 ? RLW : 11;
  let carryL = parseInt(arg.carL);
  let carryC = parseInt(arg.carC);
  let carryR = parseInt(arg.carR);
  let AltitudeFactor = 1.8;

  switch (SurfaceType) {
    case "ATDI":
      Surface = 2;
      break;
    case "AT":
      Surface = 4;
      break;
    case "ATGO":
      Surface = 3;
      break;
    case "DIRT":
      Surface = 1;
      break;
    case "DGA":
      Surface = 0;
      break;
    case "FIELD":
      Surface = -3;
      break;
    case "FT":
      Surface = 1;
      break;
    case "GRASS":
      Surface = -1;
      break;
    case "LAWN":
      Surface = -2;
      break;
    case "MG":
      Surface = 0;
      break;
    default:
      Surface = 0;
  }

  if (Altitude != 0) {
    if (2 * (Math.sqrt(Altitude / 100) - 1 + 100 / 100) - 4 > 0) {
      AltitudeFactor =
        2 * (2 * (Math.sqrt(Altitude / 100) - 1 + 100 / 100) - 4);
    } else {
      AltitudeFactor = 2 * (Math.sqrt(Altitude / 100) - 1 + 100 / 100) - 4;
    }
  }

  AltitudeFactor = round(AltitudeFactor, 1);

  let LBA =
    (+100 -
      (RL - 330) / 3 -
      (RF - 360) / 5 -
      (RC - 390) / 7 -
      (CF - 405) / 10 +
      Surface -
      FoulArea +
      (carryR + AltitudeFactor - 1.798) / 2 +
      (carryC + AltitudeFactor - 1.798) / 4 +
      (RL + RF + RC + CF - 1485) / 7) /
    100;
  let RBA =
    (+100 -
      (LL - 330) / 3 -
      (LF - 360) / 5 -
      (LC - 390) / 7 -
      (CF - 405) / 10 +
      Surface -
      FoulArea +
      (carryL + AltitudeFactor - 1.798) / 2 +
      (carryC + AltitudeFactor - 1.798) / 4 +
      (LL + LF + LC + CF - 1485) / 7) /
    100;
  let Doubles =
    (100 +
      ((LC + RC + CF - 1185) * 0.06 +
        (LL + RL - 660) * 0.325 +
        ((dLLW + dLFW + dLCW + dRCW + dRFW + dRLW - 66) / 6) * 2.2)) /
    100;
  let Triples =
    ((+100 +
      (LL - 330) / 2.5 +
      (CF - 405) / 8 +
      (RL - 330) / 16 +
      (LC - 390) / 11 +
      (RC - 390) / 12) /
      100 +
      ((AltitudeFactor - 1.798) * 0.0225) / 2 +
      ((carryL * 0.16 + carryC * 0.5 + carryR * 0.34) * 0.06) / 2) *
    (1 + Surface * 0.089);
  let LHR =
    (+100 -
      (RL - 330) / 1.5 -
      (RF - 360) / 2.75 -
      (RC - 390) / 7 -
      (CF - 405) / 21 -
      (LC - 390) / 30 -
      (RLW * 2.658 + RFW * 1.45 + RCW * 0.57 + CFW * 0.19 + LCW * 0.133 - 55) /
        7.5) /
      100 +
    (AltitudeFactor - 1.798) * 0.0225 +
    ((carryR * 1.567 + carryC * 0.275) / 1.842) * 0.06;
  let RHR =
    (+100 -
      (LL - 330) / 1.5 -
      (LF - 360) / 2.75 -
      (LC - 390) / 7 -
      (CF - 405) / 21 -
      (RC - 390) / 30 -
      (LLW * 2.658 + LFW * 1.45 + LCW * 0.57 + CFW * 0.19 + RCW * 0.133 - 55) /
        7.5) /
      100 +
    (AltitudeFactor - 1.798) * 0.0225 +
    ((carryL * 1.567 + carryC * 0.275) / 1.842) * 0.06;

  let arr = {
    avgLHB: (Math.round(LBA * 1000) / 1000).toFixed(3),
    avgRHB: (Math.round(RBA * 1000) / 1000).toFixed(3),
    doubles: (Math.round(Doubles * 1000) / 1000).toFixed(3),
    triples: (Math.round(Triples * 1000) / 1000).toFixed(3),
    hrLHB: (Math.round(LHR * 1000) / 1000).toFixed(3),
    hrRHB: (Math.round(RHR * 1000) / 1000).toFixed(3),
  };

  event.sender.send("calculate-factors-response", arr);
});

ipcMain.on("get-template", (event, arg) => {
  var data = fs.readFileSync(__dirname + "/MowPatternTemplate.zip");
  var saveOptions = {
    defaultPath: app.getPath("downloads") + "/MowPatternTemplate.zip",
  };
  dialog.showSaveDialog(null, saveOptions).then((result) => {
    if (!result.canceled) {
      fs.writeFile(result.filePath, data, function (err) {
        if (err) {
          dialog.showMessageBox(null, {
            type: "error",
            message: "An error occurred:\r\n\r\n" + err,
          });
        }
      });
    }
  });
});

ipcMain.on("add-image", (event, arg) => {
  let json = {};
  const options = {
    defaultPath: store.get("uploadImagePath", app.getPath("pictures")),
    properties: ["openFile"],
    filters: [
      {
        name: "Images",
        extensions: ["png", "jpg", "jpeg", "gif", "bmp", "tiff"],
      },
    ],
  };
  dialog.showOpenDialog(null, options).then((result) => {
    if (!result.canceled) {
      store.set("uploadImagePath", path.dirname(result.filePaths[0]));
      Jimp.read(result.filePaths[0], (err, image) => {
        if (err) {
          json.filename = "error not an image";
          json.image = "error not an image";
          event.sender.send("add-image-response", json);
        } else {
          image.getBase64(Jimp.AUTO, (err, ret) => {
            json.path = result.filePaths[0];
            json.filename = path.basename(result.filePaths[0]);
            json.image = ret;
            event.sender.send("add-image-response", json);
          });
        }
      });
    } else {
      //res.end();
      console.log("cancelled");
    }
  });
});

ipcMain.on("add-pattern", (event, arg) => {
    let json = {};
    const options = {
      defaultPath: store.get("uploadImagePath", app.getPath("pictures")),
      properties: ["openFile"],
      filters: [
        {
          name: "Images",
          extensions: ["png", "gif"],
        },
      ],
    };
    dialog.showOpenDialog(null, options).then((result) => {
      if (!result.canceled) {
        store.set("uploadImagePath", path.dirname(result.filePaths[0]));
        Jimp.read(result.filePaths[0], (err, image) => {
          if (err) {
            json.filename = "error not an image";
            json.image = "error not an image";
            event.sender.send("add-pattern-response", json);
          } else {
            image.getBase64(Jimp.AUTO, (err, ret) => {
              json.path = result.filePaths[0];
              json.filename = path.basename(result.filePaths[0]);
              json.image = ret;
              event.sender.send("add-pattern-response", json);
            });
          }
        });
      } else {
        //res.end();
        console.log("cancelled");
      }
    });
  });

ipcMain.on("save-ballpark", (event, arg) => {
  let parkName = arg.json.formValues.ballparkName;
  let parkType,
    parkSurface,
    dayBGImage,
    foulArea,
    avg,
    hr,
    webcastBuffer,
    nightBuffer,
    dayBuffer,
    domeBuffer,
    txtBuffer,
    xmlBuffer;
  let txt =
    'Night background image modifed from "Progressive Field Stadium Lights" by laffy4k (http://www.flickr.com/photos/laffy4k/), used by Creative Commons 2.0 License\r\n\r\nDay background image modified from "Mike Redmond" by Wendy Berry (https://www.flickr.com/photos/twodolla/), used by Creative Commons 2.0 License\r\n';

  if (parkName.length < 1) {
    parkName = "Unnamed_Ballpark";
  }
  parkName = parkName.replace(/[^a-zA-Z0-9]/g, "_");

  let buffer = Buffer.from(
    arg.imageData.replace(/^data:image\/(png|gif|jpeg);base64,/, ""),
    "base64"
  );

  switch (arg.json.formValues.ballparkType) {
    case "1":
      parkType = "Open Ballpark";
      break;
    case "2":
      parkType = "Retractable Roof";
      break;
    case "3":
      parkType = "Dome";
      txt =
        "Background image by Wikipedia user Dlz28 (http://en.wikipedia.org/wiki/User:Dlz28)\r\n";
      break;
    default:
      parkType = "Open Ballpark";
      break;
  }

  txtBuffer = Buffer.from(txt, "utf-8");

  switch (arg.json.formValues.ballparkSurface) {
    case "AT":
      parkSurface = "Artificial Turf";
      dayBGImage = "./images/turf_bg.png";
      break;
    case "ATDI":
      parkSurface = "Artificial Turf w/Dirt Infield";
      dayBGImage = "./images/turf_bg.png";
      break;
    case "ATGO":
      parkSurface = "Artificial Turf w/Grass Outfield";
      dayBGImage = "./images/turf_bg.png";
      break;
    case "DIRT":
      parkSurface = "Dirt";
      dayBGImage = "./images/day_bg.png";
      break;
    case "DGA":
      parkSurface = "Dirt w/Grass Outfield";
      dayBGImage = "./images/day_bg.png";
      break;
    case "FIELD":
      parkSurface = "Field";
      dayBGImage = "./images/day_bg.png";
      break;
    case "FT":
      parkSurface = "Field Turf";
      dayBGImage = "./images/turf_bg.png";
      break;
    case "GRASS":
      parkSurface = "Grass";
      dayBGImage = "./images/day_bg.png";
      break;
    case "LAWN":
      parkSurface = "Lawn";
      dayBGImage = "./images/day_bg.png";
      break;
    case "MG":
      parkSurface = "Manicured Grass";
      dayBGImage = "./images/day_bg.png";
      break;
    default:
      parkSurface = "Manicured Grass";
      dayBGImage = "./images/day_bg.png";
      break;
  }

  switch (arg.json.formValues.ballparkFoulArea) {
    case "-4":
      foulArea = "Extra Small";
      break;
    case "-3":
      foulArea = "Small";
      break;
    case "0":
      foulArea = "Average";
      break;
    case "2":
      foulArea = "Large";
      break;
    case "3":
      foulArea = "Very Large";
      break;
    case "4":
      foulArea = "Extra Large";
      break;
    default:
      foulArea = "Average";
      break;
  }

  avg = round(
    (parseFloat(arg.json.formValues.avgLHB) * 2 + parseFloat(arg.json.formValues.avgRHB)) / 3,
    3
  ).toFixed(3);
  hr = round(
    (parseFloat(arg.json.formValues.hrRHB) * 2 + parseFloat(arg.json.formValues.hrLHB)) / 3,
    3
  ).toFixed(3);
  //event.sender.send('hide-overlay', null)

  const output = fs.createWriteStream(tempDir + "/" + parkName + ".zip");

  output.on("close", function () {
    var data = fs.readFileSync(tempDir + "/" + parkName + ".zip");
    var saveOptions = {
      defaultPath: increment(
        store.get("downloadPath", app.getPath("downloads")) +
          "/" +
          parkName +
          ".zip",
        { fs: true }
      ),
    };
    dialog.showSaveDialog(null, saveOptions).then((result) => {
      if (!result.canceled) {
        store.set("downloadPath", path.dirname(result.filePath));
        fs.writeFile(result.filePath, data, function (err) {
          if (err) {
            fs.unlink(tempDir + "/" + parkName + ".zip", (err) => {
              if (err) {
                dialog.showMessageBox(null, {
                  type: "error",
                  message: "An error occurred:\r\n\r\n" + err,
                });
                event.sender.send("hide-overlay", null);
                return;
              }
            });
          }
          /* dialog.showMessageBox(null, {
            type: "error",
            message: "An error occurred:\r\n\r\n" + err,
          }); */
          event.sender.send("hide-overlay", null);
        });
      } else {
        event.sender.send("hide-overlay", null);
      }
    });
  });

  const archive = archiver("zip", {
    zlib: { level: 9 }, // Sets the compression level.
  });

  archive.on("error", function (err) {
    throw err;
  });

  archive.pipe(output);

  prepareImages();

  async function prepareImages() {
    let field = await Jimp.read(buffer);

    if (parkType == "Dome") {
      let dome = await Jimp.read(__dirname + "/images/dome.png");
      await dome.composite(field, 100, 0, { mode: Jimp.BLEND_SOURCE_OVER });
      let domeBuffer = await dome.getBufferAsync(Jimp.MIME_PNG);
      archive.append(domeBuffer, { name: parkName + "_dome.png" });
    } else {
      let day = await Jimp.read(__dirname + "/images/day_bg.png");
      let night = await Jimp.read(__dirname + "/images/night_bg.png");
      await day.composite(field, 100, 0, { mode: Jimp.BLEND_SOURCE_OVER });
      await night.composite(field, 100, 0, { mode: Jimp.BLEND_SOURCE_OVER });
      let dayBuffer = await day.getBufferAsync(Jimp.MIME_PNG);
      let nightBuffer = await night.getBufferAsync(Jimp.MIME_PNG);
      archive.append(dayBuffer, { name: parkName + "_day.png" });
      archive.append(nightBuffer, { name: parkName + "_night.png" });
    }
    archive.append(buffer, { name: parkName + "_webcast.png" });
    //archive.append(json, { name: parkName + ".json" });
    archive.append(JSON.stringify(arg.json, null, 2), {name: parkName+".park"})
    archive.append(txtBuffer, { name: "readme.txt" });
    archive.finalize();
  }
})

ipcMain.on('load-ballpark', (event, arg) => {
	let json = {}
	const options = {
		defaultPath: store.get("uploadParkPath", app.getPath('downloads')),
		properties: ['openFile'],
		filters: [
			{ name: 'Park Files', extensions: ['park', 'zip'] }
		]
	}
	dialog.showOpenDialog(null, options).then(result => {
		if(!result.canceled) {
			store.set("uploadParkPath", path.dirname(result.filePaths[0]))
			switch (getExtension(result.filePaths[0])) {
				case "park":
					json.result = "success",
					json.json = JSON.stringify(JSON.parse(fs.readFileSync(result.filePaths[0]).toString()))
					event.sender.send('load-park-response', json)
					break;
				case "zip":
					var parkFile = null;
					var zip = new admzip(result.filePaths[0]);
					var zipEntries = zip.getEntries()
					zipEntries.forEach(function (zipEntry) {
						if (zipEntry.entryName.slice(-5).toLowerCase() == '.park') {
							parkFile = zipEntry
						}
					});
					if (parkFile != null) {
						json.result = "success"
						json.json = JSON.stringify(JSON.parse(parkFile.getData().toString("utf8")))
						event.sender.send('load-park-response', json)
					} else {
						json.result = "error",
						json.message = "No valid ballpark file was found in "+path.basename(result.filePaths[0])
						event.sender.send('load-park-response', json)
					}
					break;
				default:
					json.result = "error",
					json.message = "Invalid file type: "+path.basename(result.filePaths[0])
					event.sender.send('load-park-response', json)
			}
			event.sender.send('hide-overlay', null)
		} else {
			event.sender.send('hide-overlay', null)
		}
	}).catch(err => {
		json.result = "error",
		json.message = err
		event.sender.send('load-park-response', json)
		console.log(err)
	})
})

ipcMain.on('show-alert', (event, arg) => {
	dialog.showMessageBox(null, {
		type: 'info',
		message: arg
	})
})

ipcMain.on('show-error', (event, arg) => {
	dialog.showMessageBox(null, {
		type: 'error',
		message: arg
	})
})

const createWindow = () => {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 875,
    icon: __dirname + "/images/ballpark.png",
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  const template = [
    // { role: 'appMenu' }
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: "about" },
              { type: "separator" },
              { role: "services" },
              { type: "separator" },
              { role: "hide" },
              { role: "hideOthers" },
              { role: "unhide" },
              { type: "separator" },
              { role: "quit" },
            ],
          },
        ]
      : []),
    // { role: 'fileMenu' }
    {
      label: "File",
      submenu: [
        {
          click: () => mainWindow.webContents.send("load-ballpark", "click"),
          accelerator: isMac ? "Cmd+L" : "Control+L",
          label: "Load Ballpark",
        },
        { type: "separator" },
        {
          click: () => mainWindow.webContents.send("save-ballpark", "click"),
          accelerator: isMac ? "Cmd+S" : "Control+S",
          label: "Save Ballpark",
        },
        { type: "separator" },
        isMac ? { role: "close" } : { role: "quit" },
      ],
    },
    // { role: 'viewMenu' }
    {
      label: "Action",
      submenu: [
        {
          click: () => mainWindow.webContents.send("random-ballpark", "click"),
          accelerator: isMac ? "Cmd+Alt+R" : "Control+Alt+R",
          label: "Generate Random Ballpark",
        },
        {
            click: () => mainWindow.webContents.send("random-name", "click"),
            accelerator: isMac ? "Cmd+Alt+E" : "Control+Alt+E",
            label: "Randomize Ballpark Name",
        },
        {
          click: () => mainWindow.webContents.send("flip-ballpark", "click"),
          accelerator: isMac ? "Cmd+Alt+F" : "Control+Alt+F",
          label: "Flip Ballpark",
        },
        {
          click: () => mainWindow.webContents.send("add-pattern", "click"),
          accelerator: isMac ? "Cmd+Alt+M" : "Control+Alt+M",
          label: "Add Mow Pattern",
        },
        {
          click: () => mainWindow.webContents.send("add-image", "click"),
          accelerator: isMac ? "Cmd+Alt+I" : "Control+Alt+I",
          label: "Add Field Image",
        },
        { type: "separator" },
        {
          click: () => mainWindow.webContents.send("get-template", "click"),
          accelerator: isMac ? "Cmd+Alt+T" : "Control+Alt+T",
          label: "Get Mow Pattern Template",
        },
      ],
    },
    {
      label: "View",
      submenu: [
        {   
            label: "Edit Weather Information",
            type: "radio",
            accelerator: isMac ? "Cmd+Alt+W" : "Control+Alt+W",
            click: () => mainWindow.webContents.send("show-weather", "click"),
        },
        {   
            label: "Edit Player and Ball Locations",
            type: "radio",
            accelerator: isMac ? "Cmd+Alt+B" : "Control+Alt+B",
            click: () => mainWindow.webContents.send("show-players", "click"),
        },
        { type: "separator" },
        { role: "reload" },
        { role: "forceReload" },
        { role: "toggleDevTools" },
        { type: "separator" },
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" },
      ],
    },
    // { role: 'windowMenu' }
    {
      label: "Window",
      submenu: [
        { role: "minimize" },
        { role: "zoom" },
        ...(isMac
          ? [
              { type: "separator" },
              { role: "front" },
              { type: "separator" },
              { role: "window" },
            ]
          : [{ role: "close" }]),
      ],
    },
    {
      role: "help",
      submenu: [
        {
          click: () => mainWindow.webContents.send("about", "click"),
          label: "About the OOTP Park Generator",
        },
        {
          label: "About Node.js",
          click: async () => {
            await shell.openExternal("https://nodejs.org/en/about/");
          },
        },
        {
          label: "About Electron",
          click: async () => {
            await shell.openExternal("https://electronjs.org");
          },
        },
        {
          label: "About fabric.js",
          click: async () => {
            await shell.openExternal("http://fabricjs.com/");
          },
        },
        { type: "separator" },
        {
          label: "View project on GitHub",
          click: async () => {
            await shell.openExternal(
              "https://github.com/eriqjaffe/OOTP-Park-Generator"
            );
          },
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);

  // and load the index.html of the app.
  mainWindow.loadURL(`file://${__dirname}/index.html`);

  mainWindow.webContents.on("new-window", function (e, url) {
    e.preventDefault();
    require("electron").shell.openExternal(url);
  });

  // Open the DevTools.
      mainWindow.maximize()
      mainWindow.webContents.openDevTools()
};

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

function round(value, precision) {
  var multiplier = Math.pow(10, precision || 0);
  return Math.round(value * multiplier) / multiplier;
}

function getExtension(filename) {
	var ext = path.extname(filename||'').split('.');
	return ext[ext.length - 1];
}
