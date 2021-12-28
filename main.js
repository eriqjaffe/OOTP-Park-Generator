// main.js

// Modules to control application life and create native browser window
const { app, BrowserWindow, dialog,  Menu, shell } = require('electron')
const path = require('path')
const express = require('express');
const app2 = express();
const fs = require('fs');
const initSqlJs = require('sql.js/dist/sql-wasm.js');
const filebuffer = fs.readFileSync(path.join(app.getAppPath(), 'db', 'data.sqlite'));
const { create } = require('xmlbuilder2');
const xmlescape = require('xml-escape');
const Jimp = require('jimp');
const archiver = require('archiver');
const isMac = process.platform === 'darwin'
const os = require('os');
const tempDir = os.tmpdir()
var db;

const template = [
  // { role: 'appMenu' }
  ...(isMac ? [{
    label: app.name,
    submenu: [
      { role: 'about' },
      { type: 'separator' },
      { role: 'services' },
      { type: 'separator' },
      { role: 'hide' },
      { role: 'hideOthers' },
      { role: 'unhide' },
      { type: 'separator' },
      { role: 'quit' }
    ]
  }] : []),
  // { role: 'fileMenu' }
  {
    label: 'File',
    submenu: [
      isMac ? { role: 'close' } : { role: 'quit' }
    ]
  },
  // { role: 'viewMenu' }
  {
    label: 'View',
    submenu: [
      { role: 'reload' },
      { role: 'forceReload' },
      { role: 'toggleDevTools' },
      { type: 'separator' },
      { role: 'resetZoom' },
      { role: 'zoomIn' },
      { role: 'zoomOut' },
      { type: 'separator' },
      { role: 'togglefullscreen' }
    ]
  },
  // { role: 'windowMenu' }
  {
    label: 'Window',
    submenu: [
      { role: 'minimize' },
      { role: 'zoom' },
      ...(isMac ? [
        { type: 'separator' },
        { role: 'front' },
        { type: 'separator' },
        { role: 'window' }
      ] : [
        { role: 'close' }
      ])
    ]
  },
  {
    role: 'help',
    submenu: [
      {
        label: 'About Node.js',
        click: async () => {    
          await shell.openExternal('https://nodejs.org/en/about/')
        }
      },
      {
        label: 'About Electron',
        click: async () => {
          await shell.openExternal('https://electronjs.org')
        }
      },
	{
		label: 'View project on GitHub',
		click: async () => {
		await shell.openExternal('https://github.com/eriqjaffe/OOTP-Park-Generator')
		}
	}
    ]
  }
]

const menu = Menu.buildFromTemplate(template)
Menu.setApplicationMenu(menu)

initSqlJs().then(function(SQL){
  db = new SQL.Database(filebuffer);
});

const port = 8080;

app2.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

app2.use(express.urlencoded({limit: '50mb', extended: true, parameterLimit: 50000}));

app2.get("/getCountries", (req, res) => {
  var output = [];
  output.push("United States of America");
  db.each('SELECT distinct Country from weather WHERE Country <> "United States of America" order by Country asc',
    function (row){output.push(row.Country)}
  );
  res.end(JSON.stringify(output));
})

app2.post("/stateCount", (req, res) => {
  var result = db.exec('SELECT count(State) as count from weather where Country = "'+req.body.country +'"  and length(State) > 0')
  res.end(result[0].values[0][0].toString());
})  

app2.post("/getStates", (req, res) => {
  var output = [];
  db.each('SELECT distinct State from weather WHERE Country = "'+req.body.country+'" order by Country asc',
    function (row){output.push(row.State)}
  );
  res.end(JSON.stringify(output));
})

app2.get("/getStates", (req, res) => {
  var output = [];
  db.each('SELECT distinct State from weather WHERE Country = "United States of America" order by Country asc',
    function (row){output.push(row.State)}
  );
  res.end(JSON.stringify(output));
})

app2.post("/getCities", (req, res) => {
  var output = [];
  db.each('SELECT distinct City from weather WHERE Country = "'+req.body.country+'" and State = "'+req.body.state+'" order by City asc',
    function (row){output.push(row.City)}
  );
  res.end(JSON.stringify(output));
})

app2.post("/getCitiesNS", (req, res) => {
  var output = [];
  db.each('SELECT distinct City from weather WHERE Country = "'+req.body.country+'" order by City asc',
    function (row){output.push(row.City)}
  );
  res.end(JSON.stringify(output));
})

app2.post("/getWeather", (req, res) => {
  var output = [];
  var sql = '';
  if (req.body.state == "is null") {
    sql = 'select * from weather where City = "'+req.body.city+'" and Country = "'+req.body.country+'"'
  } else {
    sql = 'select * from weather where City = "'+req.body.city+'" and State = "'+req.body.state+'" and Country = "'+req.body.country+'"'
  }
  db.each(sql,
    function (row){output.push(row)}
  );
  res.end(JSON.stringify(output));
})

app2.get("/randomName", (req, res) => {
  var sql, sql2;
  var start = getRandomIntInclusive(5, 15)
  var output;
  if (start < 11) {
    sql = 'SELECT a.name, b.parkType FROM parkNames a inner join parkType b ORDER BY RANDOM() LIMIT 1';
    db.each(sql,
      function (row){output = row.name+' '+row.parkType}
    );
    if (start == 6) {
      sql2 = "SELECT a.streetName, b.streetType FROM streetNames a inner join streetType b ORDER BY RANDOM() LIMIT 1";
      db.each(sql2,
        function (row){output += ' at '+row.streetName+' '+row.streetType}
      );
    }
  } else {
    sql = "SELECT a.streetName, b.streetType, c.parkType FROM streetNames a inner join streetType b inner join parkType c ORDER BY RANDOM() LIMIT 1";
    db.each(sql,
      function (row){output = row.streetName+' '+row.streetType+' '+row.parkType}
    );
  }
  res.end(output)
})

app2.get("/randomCity", (req, res) => {
  var output
  db.each('SELECT * FROM weather where Country = "United States of America" ORDER BY RANDOM() LIMIT 1',
    function (row){output = JSON.stringify(row)}
  )
  res.end(output)
})

function getRandomIntInclusive(min, max) {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min + 1) + min); //The maximum is inclusive and the minimum is inclusive
}


app2.post("/calculateFactors", (req, res) => {
  var ParkType = parseInt(req.body.ballparkType);
  var SurfaceType = req.body.ballparkSurface;
  var Surface = 0;
  var FoulArea = parseInt(req.body.ballparkFoulArea);
  var Altitude = parseInt(req.body.ballparkAltitude);
  var LL = parseInt(req.body.leftLine);
  var LF = parseInt(req.body.leftField);
  var LC = parseInt(req.body.leftCenter);
  var CF = parseInt(req.body.centerField);
  var RC = parseInt(req.body.rightCenter);
  var RF = parseInt(req.body.rightField);
  var RL = parseInt(req.body.rightLine);
  var LLW = parseInt(req.body.leftLineWall);
  var dLLW = (LLW > 11) ? LLW : 11;
  var LFW = parseInt(req.body.leftFieldWall);
  var dLFW = (LFW > 11) ? LFW : 11;
  var LCW = parseInt(req.body.leftCenterWall);
  var dLCW = (LCW > 11) ? LCW : 11;
  var CFW = parseInt(req.body.centerFieldWall);
  var dCFW = (CFW > 11) ? CFW : 11;
  var RCW = parseInt(req.body.rightCenterWall);
  var dRCW = (RCW > 11) ? RCW : 11;
  var RFW = parseInt(req.body.rightFieldWall);
  var dRFW = (RFW > 11) ? RFW : 11;
  var RLW = parseInt(req.body.rightLineWall);
  var dRLW = (RLW > 11) ? RLW : 11;
  var carryL = parseInt(req.body.carL);
  var carryC = parseInt(req.body.carC);
  var carryR = parseInt(req.body.carR);

  switch(SurfaceType) {
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

  if (Altitude == 0) {
    var Altitude, AltitudeFactor;
    AltitudeFactor = 1.8;
  } else {
    if (2 * (Math.sqrt(Altitude / 100) - 1 + 100 / 100) - 4 > 0) {
        AltitudeFactor = 2 * (2 * (Math.sqrt(Altitude / 100) - 1 + 100 / 100) - 4);
    } else {
        AltitudeFactor = 2 * (Math.sqrt(Altitude / 100) - 1 + 100 / 100) - 4;
    }
  }

  AltitudeFactor = round(AltitudeFactor,1)

  var LBA = (+(100)-((RL-330)/3)-((RF-360)/5)-((RC-390)/7)-((CF-405)/10)+Surface-FoulArea+((carryR+AltitudeFactor-1.798)/2)+((carryC+AltitudeFactor-1.798)/4)+((RL+RF+RC+CF-1485)/7))/100;
	var RBA = (+(100)-((LL-330)/3)-((LF-360)/5)-((LC-390)/7)-((CF-405)/10)+Surface-FoulArea+((carryL+AltitudeFactor-1.798)/2)+((carryC+AltitudeFactor-1.798)/4)+((LL+LF+LC+CF-1485)/7))/100;
	var Doubles = (100+(((((LC+RC+CF)-1185)*0.06))+(((LL+RL)-660)*0.325)+(((dLLW+dLFW+dLCW+dRCW+dRFW+dRLW-66)/6)*2.2)))/100;
	var Triples = (((+(100)+((LL-330)/2.5)+((CF-405)/8)+((RL-330)/16)+((LC-390)/11)+((RC-390)/12))/100)+(((AltitudeFactor-1.798)*0.0225)/2)+((((carryL*0.16)+(carryC*0.5)+(carryR*0.34))*0.06)/2))*(1+(Surface*0.089));
	var LHR = ((+(100)-((RL-330)/1.5)-((RF-360)/2.75)-((RC-390)/7)-((CF-405)/21)-((LC-390)/30)-(((RLW*2.658)+(RFW*1.45)+(RCW*0.57)+(CFW*0.19)+(LCW*0.133)-55)/7.5))/100)+((AltitudeFactor-1.798)*0.0225)+((((carryR*1.567)+(carryC*0.275))/1.842)*0.06);
	var RHR = ((+(100)-((LL-330)/1.5)-((LF-360)/2.75)-((LC-390)/7)-((CF-405)/21)-((RC-390)/30)-(((LLW*2.658)+(LFW*1.45)+(LCW*0.57)+(CFW*0.19)+(RCW*0.133)-55)/7.5))/100)+((AltitudeFactor-1.798)*0.0225)+((((carryL*1.567)+(carryC*0.275))/1.842)*0.06);

  var arr = {
    "avgLHB": (Math.round(LBA * 1000) / 1000).toFixed(3),
    "avgRHB": (Math.round(RBA * 1000) / 1000).toFixed(3),
    "doubles": (Math.round(Doubles * 1000) / 1000).toFixed(3),
    "triples": (Math.round(Triples * 1000) / 1000).toFixed(3),
    "hrLHB": (Math.round(LHR * 1000) / 1000).toFixed(3),
    "hrRHB": (Math.round(RHR * 1000) / 1000).toFixed(3)
  }

  res.end(JSON.stringify(arr));
})

app2.get("/getTemplate", (req, res) => {
  var data = fs.readFileSync(__dirname + '/MowPatternTemplate.zip');
  var saveOptions = {
    defaultPath: app.getPath('downloads') + '/MowPatternTemplate.zip',
  }
  dialog.showSaveDialog(null, saveOptions).then((result) => { 
    if (!result.canceled) {
      fs.writeFile(result.filePath, data, function(err) {
        if (err) {
          res.end(err)
        } else {
          res.end("success")
        };
      
      })
    }
  })
})

app2.post("/downloadBallpark", (req, res) => {
  var parkName = req.body.ballparkName;
  var parkType;
  var parkSurface;
  var dayBGImage;
  var foulArea;
  var avg;
  var hr;
  var webcastBuffer;
  var nightBuffer;
  var dayBuffer;
  var domeBuffer;
  var txt = "Night background image modifed from \"Progressive Field Stadium Lights\" by laffy4k (http://www.flickr.com/photos/laffy4k/), used by Creative Commons 2.0 License\r\n\r\nDay background image modified from \"Mike Redmond\" by Wendy Berry (https://www.flickr.com/photos/twodolla/), used by Creative Commons 2.0 License\r\n";;
  var txtBuffer;
  var xmlBuffer;
  
  if (parkName.length < 1) { parkName = 'Unnamed_Ballpark' }
  parkName = parkName.replace(/[^a-zA-Z0-9]/g, "_");

  var buffer = Buffer.from(req.body.imagedata.replace(/^data:image\/(png|gif|jpeg);base64,/,''), 'base64');

  switch (req.body.ballparkType) {
    case "1":
      parkType = 'Open Ballpark';
      break;
    case "2":
      parkType = 'Retractable Roof';
      break;
    case "3":
      parkType = 'Dome';
      txt = 'Background image by Wikipedia user Dlz28 (http://en.wikipedia.org/wiki/User:Dlz28)\r\n';
      break;
    default:
      parkType = 'Open Ballpark';
      break;
  }

  txtBuffer = Buffer.from(txt, 'utf-8');

  switch(req.body.ballparkSurface) {
    case "AT":
      parkSurface = 'Artificial Turf';
      dayBGImage = "./images/turf_bg.png";
      break;
    case "ATDI":
      parkSurface = 'Artificial Turf w/Dirt Infield';
      dayBGImage = "./images/turf_bg.png";
      break;	
    case "ATGO":
      parkSurface = 'Artificial Turf w/Grass Outfield';
      dayBGImage = "./images/turf_bg.png";
      break;
    case "DIRT":
      parkSurface = 'Dirt';
      dayBGImage = "./images/day_bg.png";
      break;
    case "DGA":
      parkSurface = 'Dirt w/Grass Outfield';
      dayBGImage = "./images/day_bg.png";
      break;
    case "FIELD":
      parkSurface = 'Field';
      dayBGImage = "./images/day_bg.png";
      break;
    case "FT":
      parkSurface = 'Field Turf';
      dayBGImage = "./images/turf_bg.png";
      break;
    case "GRASS":
      parkSurface = 'Grass';
      dayBGImage = "./images/day_bg.png";
      break;	
    case "LAWN":
      parkSurface = 'Lawn';
      dayBGImage = "./images/day_bg.png";
      break;
    case "MG":
      parkSurface = 'Manicured Grass';
      dayBGImage = "./images/day_bg.png";
      break;
    default:
      parkSurface = 'Manicured Grass';
      dayBGImage = "./images/day_bg.png";
      break;
  }

  switch(req.body.ballparkFoulArea) {
    case '-4':
      foulArea = 'Extra Small';
      break;
    case '-3':
      foulArea = 'Small';
      break;
    case '0':
      foulArea = 'Average';
      break;
    case '2':
      foulArea = 'Large';
      break;
    case '3':
      foulArea = 'Very Large';
      break;
    case '4':
      foulArea = 'Extra Large';
      break;
    default:
      foulArea = 'Average';
      break;
  }
  
  avg = round((parseFloat(req.body.avgLHB) * 2 + parseFloat(req.body.avgRHB)) / 3, 3).toFixed(3);
  hr = round((parseFloat(req.body.hrRHB) * 2 + parseFloat(req.body.hrLHB)) / 3, 3).toFixed(3);

  const root = create({ version: '1.0' })
    .ele('ballpark')
      .ele('BasicInformation')
        .ele('ballparkName').txt(xmlescape(req.body.ballparkName)).up()
        .ele('ballparkCountry').txt(xmlescape(req.body.ballparkCountry)).up()
        .ele('ballparkState').txt(xmlescape(req.body.ballparkState)).up()
        .ele('ballparkCity').txt(xmlescape(req.body.ballparkCity)).up()
        .ele('ballparkType').txt(parkType).up()
        .ele('ballparkSurface').txt(parkSurface).up()
        .ele('ballparkFoulArea').txt(foulArea).up()
        .ele('ballparkAltitude').txt(req.body.ballparkAltitude).up()
        .ele('ballparkCapacity').txt(req.body.ballparkCapacity).up()
      .up()
      .ele('BallparkDimensions')
        .ele('dimension', {distance: req.body.leftLine, height: req.body.leftLineWall}).txt('Left Field Line').up()
        .ele('dimension', {distance: req.body.leftField, height: req.body.leftFieldWall}).txt('Left Field').up()
        .ele('dimension', {distance: req.body.leftCenter, height: req.body.leftCenterWall}).txt('Left Center').up()
        .ele('dimension', {distance: req.body.centerField, height: req.body.centerFieldWall}).txt('Center Field').up()
        .ele('dimension', {distance: req.body.rightCenter, height: req.body.rightCenterWall}).txt('Right Center').up()
        .ele('dimension', {distance: req.body.rightField, height: req.body.rightFieldWall}).txt('Right Field').up()
        .ele('dimension', {distance: req.body.rightLine, height: req.body.rightLineWall}).txt('Right Field Line').up()
      .up() 
      .ele('BallparkFactors')
        .ele('factor', {value: req.body.avgLHB}).txt('avgLHB').up()
        .ele('factor', {value: req.body.avgRHB}).txt('avgRHB').up()
        .ele('factor', {value: req.body.doubles}).txt('doubles').up()
        .ele('factor', {value: req.body.triples}).txt('triples').up()
        .ele('factor', {value: req.body.hrLHB}).txt('hrLHB').up()
        .ele('factor', {value: req.body.hrRHB}).txt('hrRHB').up()
        .ele('factor', {value: avg}).txt('Average').up()
        .ele('factor', {value: hr}).txt('Home Runs').up()
      .up()
      .ele('FieldOptions')
        .ele('MowPattern').txt(req.body.mowPattern).up()
        .ele('PitchingLane').txt(req.body.pitchingLane).up()
        .ele('InfieldType').txt(req.body.infieldType).up()
        .ele('DistanceMarkers').txt(req.body.distanceMarkers).up()
        .ele('OnDeckCircles').txt(req.body.onDeckCircles).up()
      .up()
      .ele('WeatherInformation')
        .ele('month', {temperature: req.body.JanTemp, precipitation: req.body.JanRain}).txt('January').up()
        .ele('month', {temperature: req.body.FebTemp, precipitation: req.body.FebRain}).txt('February').up()
        .ele('month', {temperature: req.body.MarTemp, precipitation: req.body.MarRain}).txt('March').up()
        .ele('month', {temperature: req.body.AprTemp, precipitation: req.body.AprRain}).txt('April').up()
        .ele('month', {temperature: req.body.MayTemp, precipitation: req.body.MayRain}).txt('May').up()
        .ele('month', {temperature: req.body.JunTemp, precipitation: req.body.JunRain}).txt('June').up()
        .ele('month', {temperature: req.body.JulTemp, precipitation: req.body.JulRain}).txt('July').up()
        .ele('month', {temperature: req.body.AugTemp, precipitation: req.body.AugRain}).txt('August').up()
        .ele('month', {temperature: req.body.SepTemp, precipitation: req.body.SepRain}).txt('September').up()
        .ele('month', {temperature: req.body.OctTemp, precipitation: req.body.OctRain}).txt('October').up()
        .ele('month', {temperature: req.body.NovTemp, precipitation: req.body.NovRain}).txt('November').up()
        .ele('month', {temperature: req.body.DecTemp, precipitation: req.body.DecRain}).txt('December').up()
        .ele('AverageWind').txt(req.body.avgWind).up()
      .up()
      .ele('CalculatedWeatherFactors')
        .ele('AmbientTemperature').txt(req.body.Ambient).up()
        .ele('AverageTemperature').txt(req.body.avgTemp).up()
        .ele('AverageRain').txt(req.body.avgRain).up()
        .ele('CarryLeft').txt(req.body.carL).up()
        .ele('CarryCenter').txt(req.body.carC).up()
        .ele('CarryRight').txt(req.body.carR).up()
      .up()
      .ele('PlayerLocations')
        .ele('DayPlayerCoordinates')
          .ele('coordinate', {x:req.body.PBroadcastCoordinateX, y:req.body.PBroadcastCoordinateY,}).txt('Pitcher').up()
          .ele('coordinate', {x:req.body.CBroadcastCoordinateX, y:req.body.CBroadcastCoordinateY,}).txt('Catcher').up()
          .ele('coordinate', {x:req.body.a1BBroadcastCoordinateX, y:req.body.a1BBroadcastCoordinateX,}).txt('First Baseman').up()
          .ele('coordinate', {x:req.body.a2BBroadcastCoordinateX, y:req.body.a2BBroadcastCoordinateX,}).txt('Second Baseman').up()
          .ele('coordinate', {x:req.body.SSBroadcastCoordinateX, y:req.body.SSBroadcastCoordinateX,}).txt('Shortstop').up()
          .ele('coordinate', {x:req.body.a3BBroadcastCoordinateX, y:req.body.a3BBroadcastCoordinateX,}).txt('Third Baseman').up()
          .ele('coordinate', {x:req.body.LFBroadcastCoordinateX, y:req.body.LFBroadcastCoordinateX,}).txt('Left Fielder').up()
          .ele('coordinate', {x:req.body.CFBroadcastCoordinateX, y:req.body.CFBroadcastCoordinateX,}).txt('Center Fielder').up()
          .ele('coordinate', {x:req.body.RFBroadcastCoordinateX, y:req.body.RFBroadcastCoordinateX,}).txt('Right Fielder').up()
          .ele('coordinate', {x:req.body.R1BroadcastCoordinateX, y:req.body.R1BroadcastCoordinateX,}).txt('Runner on 1st').up()
          .ele('coordinate', {x:req.body.R2BroadcastCoordinateX, y:req.body.R2BroadcastCoordinateX,}).txt('Runner on 2nd').up()
          .ele('coordinate', {x:req.body.R3BroadcastCoordinateX, y:req.body.R3BroadcastCoordinateX,}).txt('Runner on 3rd').up()
          .ele('coordinate', {x:req.body.LHBBroadcastCoordinateX, y:req.body.LHBBroadcastCoordinateX,}).txt('Lefty Batter').up()
          .ele('coordinate', {x:req.body.RHBBroadcastCoordinateX, y:req.body.RHBBroadcastCoordinateX,}).txt('Righty Batter').up()
        .up()
        .ele('NightPlayerCoordinates')
          .ele('coordinate', {x:req.body.PBroadcastCoordinateX, y:req.body.PBroadcastCoordinateY,}).txt('Pitcher').up()
          .ele('coordinate', {x:req.body.CBroadcastCoordinateX, y:req.body.CBroadcastCoordinateY,}).txt('Catcher').up()
          .ele('coordinate', {x:req.body.a1BBroadcastCoordinateX, y:req.body.a1BBroadcastCoordinateX,}).txt('First Baseman').up()
          .ele('coordinate', {x:req.body.a2BBroadcastCoordinateX, y:req.body.a2BBroadcastCoordinateX,}).txt('Second Baseman').up()
          .ele('coordinate', {x:req.body.SSBroadcastCoordinateX, y:req.body.SSBroadcastCoordinateX,}).txt('Shortstop').up()
          .ele('coordinate', {x:req.body.a3BBroadcastCoordinateX, y:req.body.a3BBroadcastCoordinateX,}).txt('Third Baseman').up()
          .ele('coordinate', {x:req.body.LFBroadcastCoordinateX, y:req.body.LFBroadcastCoordinateX,}).txt('Left Fielder').up()
          .ele('coordinate', {x:req.body.CFBroadcastCoordinateX, y:req.body.CFBroadcastCoordinateX,}).txt('Center Fielder').up()
          .ele('coordinate', {x:req.body.RFBroadcastCoordinateX, y:req.body.RFBroadcastCoordinateX,}).txt('Right Fielder').up()
          .ele('coordinate', {x:req.body.R1BroadcastCoordinateX, y:req.body.R1BroadcastCoordinateX,}).txt('Runner on 1st').up()
          .ele('coordinate', {x:req.body.R2BroadcastCoordinateX, y:req.body.R2BroadcastCoordinateX,}).txt('Runner on 2nd').up()
          .ele('coordinate', {x:req.body.R3BroadcastCoordinateX, y:req.body.R3BroadcastCoordinateX,}).txt('Runner on 3rd').up()
          .ele('coordinate', {x:req.body.LHBBroadcastCoordinateX, y:req.body.LHBBroadcastCoordinateX,}).txt('Lefty Batter').up()
          .ele('coordinate', {x:req.body.RHBBroadcastCoordinateX, y:req.body.RHBBroadcastCoordinateX,}).txt('Righty Batter').up()
        .up()
        .ele('DiagramPlayerCoordinates')       
          .ele('coordinate', {x:req.body.PWebcastCoordinateX, y:req.body.PWebcastCoordinateY,}).txt('Pitcher').up()
          .ele('coordinate', {x:req.body.CWebcastCoordinateX, y:req.body.CWebcastCoordinateY,}).txt('Catcher').up()
          .ele('coordinate', {x:req.body.a1BWebcastCoordinateX, y:req.body.a1BWebcastCoordinateX,}).txt('First Baseman').up()
          .ele('coordinate', {x:req.body.a2BWebcastCoordinateX, y:req.body.a2BWebcastCoordinateX,}).txt('Second Baseman').up()
          .ele('coordinate', {x:req.body.SSWebcastCoordinateX, y:req.body.SSWebcastCoordinateX,}).txt('Shortstop').up()
          .ele('coordinate', {x:req.body.a3BWebcastCoordinateX, y:req.body.a3BWebcastCoordinateX,}).txt('Third Baseman').up()
          .ele('coordinate', {x:req.body.LFWebcastCoordinateX, y:req.body.LFWebcastCoordinateX,}).txt('Left Fielder').up()
          .ele('coordinate', {x:req.body.CFWebcastCoordinateX, y:req.body.CFWebcastCoordinateX,}).txt('Center Fielder').up()
          .ele('coordinate', {x:req.body.RFWebcastCoordinateX, y:req.body.RFWebcastCoordinateX,}).txt('Right Fielder').up()
          .ele('coordinate', {x:req.body.R1WebcastCoordinateX, y:req.body.R1WebcastCoordinateX,}).txt('Runner on 1st').up()
          .ele('coordinate', {x:req.body.R2WebcastCoordinateX, y:req.body.R2WebcastCoordinateX,}).txt('Runner on 2nd').up()
          .ele('coordinate', {x:req.body.R3WebcastCoordinateX, y:req.body.R3WebcastCoordinateX,}).txt('Runner on 3rd').up()
          .ele('coordinate', {x:req.body.LHBWebcastCoordinateX, y:req.body.LHBWebcastCoordinateX,}).txt('Lefty Batter').up()
          .ele('coordinate', {x:req.body.RHBWebcastCoordinateX, y:req.body.RHBWebcastCoordinateX,}).txt('Righty Batter').up()
        .up()
      .up()
      .ele('BallFlightCoordinates')
        .ele('DayBallCoordinates')
          .ele('coordinate', {x:req.body.xWLLBroadcastCoordinateX, y:req.body.xWLLBroadcastCoordinateY}).txt('WLL').up()
          .ele('coordinate', {x:req.body.xWLBroadcastCoordinateX, y:req.body.xWLBroadcastCoordinateY}).txt('W L').up()
          .ele('coordinate', {x:req.body.xWLCBroadcastCoordinateX, y:req.body.xWLCBroadcastCoordinateY}).txt('WLC').up()
          .ele('coordinate', {x:req.body.xWCBroadcastCoordinateX, y:req.body.xWCBroadcastCoordinateY}).txt('W C').up()
          .ele('coordinate', {x:req.body.xWRCBroadcastCoordinateX, y:req.body.xWRCBroadcastCoordinateY}).txt('WRC').up()
          .ele('coordinate', {x:req.body.xWRBroadcastCoordinateX, y:req.body.xWRBroadcastCoordinateY}).txt('W R').up()
          .ele('coordinate', {x:req.body.xWRLBroadcastCoordinateX, y:req.body.xWRLBroadcastCoordinateY}).txt('WRL').up()
          .ele('coordinate', {x:req.body.x7LSBroadcastCoordinateX, y:req.body.x7LSBroadcastCoordinateY}).txt('7LS').up()
          .ele('coordinate', {x:req.body.x7LMBroadcastCoordinateX, y:req.body.x7LMBroadcastCoordinateY}).txt('7LM').up()
          .ele('coordinate', {x:req.body.x7LDBroadcastCoordinateX, y:req.body.x7LDBroadcastCoordinateY}).txt('7LD').up()
          .ele('coordinate', {x:req.body.x7SBroadcastCoordinateX, y:req.body.x7SBroadcastCoordinateY}).txt('7S').up()
          .ele('coordinate', {x:req.body.x7MBroadcastCoordinateX, y:req.body.x7MBroadcastCoordinateY}).txt('7M').up()
          .ele('coordinate', {x:req.body.x7DBroadcastCoordinateX, y:req.body.x7DBroadcastCoordinateY}).txt('7D').up()
          .ele('coordinate', {x:req.body.x78SBroadcastCoordinateX, y:req.body.x78SBroadcastCoordinateY}).txt('78S').up()
          .ele('coordinate', {x:req.body.x78MBroadcastCoordinateX, y:req.body.x78MBroadcastCoordinateY}).txt('78M').up()
          .ele('coordinate', {x:req.body.x78DBroadcastCoordinateX, y:req.body.x78DBroadcastCoordinateY}).txt('78D').up()
          .ele('coordinate', {x:req.body.x78XDBroadcastCoordinateX, y:req.body.x78XDBroadcastCoordinateY}).txt('78XD').up()
          .ele('coordinate', {x:req.body.x8LSBroadcastCoordinateX, y:req.body.x8LSBroadcastCoordinateY}).txt('8LS').up()
          .ele('coordinate', {x:req.body.x8LMBroadcastCoordinateX, y:req.body.x8LMBroadcastCoordinateY}).txt('8LM').up()
          .ele('coordinate', {x:req.body.x8LDBroadcastCoordinateX, y:req.body.x8LDBroadcastCoordinateY}).txt('8LD').up()
          .ele('coordinate', {x:req.body.x8LXDBroadcastCoordinateX, y:req.body.x8LXDBroadcastCoordinateY}).txt('8LXD').up()
          .ele('coordinate', {x:req.body.x8RSBroadcastCoordinateX, y:req.body.x8RSBroadcastCoordinateY}).txt('8RS').up()
          .ele('coordinate', {x:req.body.x8RMBroadcastCoordinateX, y:req.body.x8RMBroadcastCoordinateY}).txt('8RM').up()
          .ele('coordinate', {x:req.body.x8RDBroadcastCoordinateX, y:req.body.x8RDBroadcastCoordinateY}).txt('8RD').up()
          .ele('coordinate', {x:req.body.x8RXDBroadcastCoordinateX, y:req.body.x8RXDBroadcastCoordinateY}).txt('8RXD').up()
          .ele('coordinate', {x:req.body.x9LSBroadcastCoordinateX, y:req.body.x9LSBroadcastCoordinateY}).txt('9LS').up()
          .ele('coordinate', {x:req.body.x9LMBroadcastCoordinateX, y:req.body.x9LMBroadcastCoordinateY}).txt('9LM').up()
          .ele('coordinate', {x:req.body.x9LDBroadcastCoordinateX, y:req.body.x9LDBroadcastCoordinateY}).txt('9LD').up()
          .ele('coordinate', {x:req.body.x9SBroadcastCoordinateX, y:req.body.x9SBroadcastCoordinateY}).txt('9S').up()
          .ele('coordinate', {x:req.body.x9MBroadcastCoordinateX, y:req.body.x9MBroadcastCoordinateY}).txt('9M').up()
          .ele('coordinate', {x:req.body.x9DBroadcastCoordinateX, y:req.body.x9DBroadcastCoordinateY}).txt('9D').up()
          .ele('coordinate', {x:req.body.x89SBroadcastCoordinateX, y:req.body.x89SBroadcastCoordinateY}).txt('89S').up()
          .ele('coordinate', {x:req.body.x89MBroadcastCoordinateX, y:req.body.x89MBroadcastCoordinateY}).txt('89M').up()
          .ele('coordinate', {x:req.body.x89DBroadcastCoordinateX, y:req.body.x89DBroadcastCoordinateY}).txt('89D').up()
          .ele('coordinate', {x:req.body.x89DBroadcastCoordinateX, y:req.body.x89DBroadcastCoordinateY}).txt('89XD').up()
          .ele('coordinate', {x:req.body.x3BroadcastCoordinateX, y:req.body.x3BroadcastCoordinateY}).txt('3').up()
          .ele('coordinate', {x:req.body.x4BroadcastCoordinateX, y:req.body.x4BroadcastCoordinateY}).txt('4').up()
          .ele('coordinate', {x:req.body.x5BroadcastCoordinateX, y:req.body.x5BroadcastCoordinateY}).txt('5').up()
          .ele('coordinate', {x:req.body.x6BroadcastCoordinateX, y:req.body.x6BroadcastCoordinateY}).txt('6').up()
          .ele('coordinate', {x:req.body.x13BroadcastCoordinateX, y:req.body.x13BroadcastCoordinateY}).txt('13').up()
          .ele('coordinate', {x:req.body.x15BroadcastCoordinateX, y:req.body.x15BroadcastCoordinateY}).txt('15').up()
          .ele('coordinate', {x:req.body.x23BroadcastCoordinateX, y:req.body.x23BroadcastCoordinateY}).txt('23').up()
          .ele('coordinate', {x:req.body.x25BroadcastCoordinateX, y:req.body.x25BroadcastCoordinateY}).txt('25').up()
          .ele('coordinate', {x:req.body.x34BroadcastCoordinateX, y:req.body.x34BroadcastCoordinateY}).txt('34').up()
          .ele('coordinate', {x:req.body.x56BroadcastCoordinateX, y:req.body.x56BroadcastCoordinateY}).txt('56').up()
          .ele('coordinate', {x:req.body.x13SBroadcastCoordinateX, y:req.body.x13SBroadcastCoordinateY}).txt('13S').up()
          .ele('coordinate', {x:req.body.x15SBroadcastCoordinateX, y:req.body.x15SBroadcastCoordinateY}).txt('15S').up()
          .ele('coordinate', {x:req.body.x2LBroadcastCoordinateX, y:req.body.x2LBroadcastCoordinateY}).txt('2L').up()
          .ele('coordinate', {x:req.body.x2RBroadcastCoordinateX, y:req.body.x2RBroadcastCoordinateY}).txt('2R').up()
          .ele('coordinate', {x:req.body.x34DBroadcastCoordinateX, y:req.body.x34DBroadcastCoordinateY}).txt('34D').up()
          .ele('coordinate', {x:req.body.x34SBroadcastCoordinateX, y:req.body.x34SBroadcastCoordinateY}).txt('34S').up()
          .ele('coordinate', {x:req.body.x3DBroadcastCoordinateX, y:req.body.x3DBroadcastCoordinateY}).txt('3D').up()
          .ele('coordinate', {x:req.body.x3LBroadcastCoordinateX, y:req.body.x3LBroadcastCoordinateY}).txt('3L').up()
          .ele('coordinate', {x:req.body.x3SBroadcastCoordinateX, y:req.body.x3SBroadcastCoordinateY}).txt('3S').up()
          .ele('coordinate', {x:req.body.x4DBroadcastCoordinateX, y:req.body.x4DBroadcastCoordinateY}).txt('4D').up()
          .ele('coordinate', {x:req.body.x4MBroadcastCoordinateX, y:req.body.x4MBroadcastCoordinateY}).txt('4M').up()
          .ele('coordinate', {x:req.body.x4MDBroadcastCoordinateX, y:req.body.x4MDBroadcastCoordinateY}).txt('4MD').up()
          .ele('coordinate', {x:req.body.x4MSBroadcastCoordinateX, y:req.body.x4MSBroadcastCoordinateY}).txt('4MS').up()
          .ele('coordinate', {x:req.body.x4SBroadcastCoordinateX, y:req.body.x4SBroadcastCoordinateY}).txt('4S').up()
          .ele('coordinate', {x:req.body.x56DBroadcastCoordinateX, y:req.body.x56DBroadcastCoordinateY}).txt('56D').up()
          .ele('coordinate', {x:req.body.x56SBroadcastCoordinateX, y:req.body.x56SBroadcastCoordinateY}).txt('56S').up()
          .ele('coordinate', {x:req.body.x5DBroadcastCoordinateX, y:req.body.x5DBroadcastCoordinateY}).txt('5D').up()
          .ele('coordinate', {x:req.body.x5LBroadcastCoordinateX, y:req.body.x5LBroadcastCoordinateY}).txt('5L').up()
          .ele('coordinate', {x:req.body.x5SBroadcastCoordinateX, y:req.body.x5SBroadcastCoordinateY}).txt('5S').up()
          .ele('coordinate', {x:req.body.x6DBroadcastCoordinateX, y:req.body.x6DBroadcastCoordinateY}).txt('6D').up()
          .ele('coordinate', {x:req.body.x6MBroadcastCoordinateX, y:req.body.x6MBroadcastCoordinateY}).txt('6M').up()
          .ele('coordinate', {x:req.body.x6MDBroadcastCoordinateX, y:req.body.x6MDBroadcastCoordinateY}).txt('6MD').up()
          .ele('coordinate', {x:req.body.x6MSBroadcastCoordinateX, y:req.body.x6MSBroadcastCoordinateY}).txt('6MS').up()
          .ele('coordinate', {x:req.body.x6SBroadcastCoordinateX, y:req.body.x6SBroadcastCoordinateY}).txt('6S').up()
          .ele('coordinate', {x:req.body.xHPBroadcastCoordinateX, y:req.body.xHPBroadcastCoordinateY}).txt('HP').up()
          .ele('coordinate', {x:req.body.x2FBroadcastCoordinateX, y:req.body.x2FBroadcastCoordinateY}).txt('2F').up()
          .ele('coordinate', {x:req.body.x2LFBroadcastCoordinateX, y:req.body.x2LFBroadcastCoordinateY}).txt('2LF').up()
          .ele('coordinate', {x:req.body.x2RFBroadcastCoordinateX, y:req.body.x2RFBroadcastCoordinateY}).txt('2RF').up()
          .ele('coordinate', {x:req.body.x5DFBroadcastCoordinateX, y:req.body.x5DFBroadcastCoordinateY}).txt('5DF').up()
          .ele('coordinate', {x:req.body.x3DFBroadcastCoordinateX, y:req.body.x3DFBroadcastCoordinateY}).txt('3DF').up()
          .ele('coordinate', {x:req.body.x5FBroadcastCoordinateX, y:req.body.x5FBroadcastCoordinateY}).txt('5F').up()
          .ele('coordinate', {x:req.body.x3FBroadcastCoordinateX, y:req.body.x3FBroadcastCoordinateY}).txt('3F').up()
          .ele('coordinate', {x:req.body.x5SFBroadcastCoordinateX, y:req.body.x5SFBroadcastCoordinateY}).txt('5SF').up()
          .ele('coordinate', {x:req.body.x3SFBroadcastCoordinateX, y:req.body.x3SFBroadcastCoordinateY}).txt('3SF').up()
          .ele('coordinate', {x:req.body.x25FBroadcastCoordinateX, y:req.body.x25FBroadcastCoordinateY}).txt('25F').up()
          .ele('coordinate', {x:req.body.x23FBroadcastCoordinateX, y:req.body.x23FBroadcastCoordinateY}).txt('23F').up()
          .ele('coordinate', {x:req.body.x7LDBroadcastCoordinateX, y:req.body.x7LDBroadcastCoordinateY}).txt('7LD').up()
          .ele('coordinate', {x:req.body.x7LMBroadcastCoordinateX, y:req.body.x7LMBroadcastCoordinateY}).txt('7LM').up()
          .ele('coordinate', {x:req.body.x7LSBroadcastCoordinateX, y:req.body.x7LSBroadcastCoordinateY}).txt('7LS').up()
          .ele('coordinate', {x:req.body.x9LDBroadcastCoordinateX, y:req.body.x9LDBroadcastCoordinateY}).txt('9LD').up()
          .ele('coordinate', {x:req.body.x9LMBroadcastCoordinateX, y:req.body.x9LMBroadcastCoordinateY}).txt('9LM').up()
          .ele('coordinate', {x:req.body.x9LSBroadcastCoordinateX, y:req.body.x9LSBroadcastCoordinateY}).txt('9LS').up()
        .up()
        .ele('NightBallCoordinates')
          .ele('coordinate', {x:req.body.xWLLBroadcastCoordinateX, y:req.body.xWLLBroadcastCoordinateY}).txt('WLL').up()
          .ele('coordinate', {x:req.body.xWLBroadcastCoordinateX, y:req.body.xWLBroadcastCoordinateY}).txt('W L').up()
          .ele('coordinate', {x:req.body.xWLCBroadcastCoordinateX, y:req.body.xWLCBroadcastCoordinateY}).txt('WLC').up()
          .ele('coordinate', {x:req.body.xWCBroadcastCoordinateX, y:req.body.xWCBroadcastCoordinateY}).txt('W C').up()
          .ele('coordinate', {x:req.body.xWRCBroadcastCoordinateX, y:req.body.xWRCBroadcastCoordinateY}).txt('WRC').up()
          .ele('coordinate', {x:req.body.xWRBroadcastCoordinateX, y:req.body.xWRBroadcastCoordinateY}).txt('W R').up()
          .ele('coordinate', {x:req.body.xWRLBroadcastCoordinateX, y:req.body.xWRLBroadcastCoordinateY}).txt('WRL').up()
          .ele('coordinate', {x:req.body.x7LSBroadcastCoordinateX, y:req.body.x7LSBroadcastCoordinateY}).txt('7LS').up()
          .ele('coordinate', {x:req.body.x7LMBroadcastCoordinateX, y:req.body.x7LMBroadcastCoordinateY}).txt('7LM').up()
          .ele('coordinate', {x:req.body.x7LDBroadcastCoordinateX, y:req.body.x7LDBroadcastCoordinateY}).txt('7LD').up()
          .ele('coordinate', {x:req.body.x7SBroadcastCoordinateX, y:req.body.x7SBroadcastCoordinateY}).txt('7S').up()
          .ele('coordinate', {x:req.body.x7MBroadcastCoordinateX, y:req.body.x7MBroadcastCoordinateY}).txt('7M').up()
          .ele('coordinate', {x:req.body.x7DBroadcastCoordinateX, y:req.body.x7DBroadcastCoordinateY}).txt('7D').up()
          .ele('coordinate', {x:req.body.x78SBroadcastCoordinateX, y:req.body.x78SBroadcastCoordinateY}).txt('78S').up()
          .ele('coordinate', {x:req.body.x78MBroadcastCoordinateX, y:req.body.x78MBroadcastCoordinateY}).txt('78M').up()
          .ele('coordinate', {x:req.body.x78DBroadcastCoordinateX, y:req.body.x78DBroadcastCoordinateY}).txt('78D').up()
          .ele('coordinate', {x:req.body.x78XDBroadcastCoordinateX, y:req.body.x78XDBroadcastCoordinateY}).txt('78XD').up()
          .ele('coordinate', {x:req.body.x8LSBroadcastCoordinateX, y:req.body.x8LSBroadcastCoordinateY}).txt('8LS').up()
          .ele('coordinate', {x:req.body.x8LMBroadcastCoordinateX, y:req.body.x8LMBroadcastCoordinateY}).txt('8LM').up()
          .ele('coordinate', {x:req.body.x8LDBroadcastCoordinateX, y:req.body.x8LDBroadcastCoordinateY}).txt('8LD').up()
          .ele('coordinate', {x:req.body.x8LXDBroadcastCoordinateX, y:req.body.x8LXDBroadcastCoordinateY}).txt('8LXD').up()
          .ele('coordinate', {x:req.body.x8RSBroadcastCoordinateX, y:req.body.x8RSBroadcastCoordinateY}).txt('8RS').up()
          .ele('coordinate', {x:req.body.x8RMBroadcastCoordinateX, y:req.body.x8RMBroadcastCoordinateY}).txt('8RM').up()
          .ele('coordinate', {x:req.body.x8RDBroadcastCoordinateX, y:req.body.x8RDBroadcastCoordinateY}).txt('8RD').up()
          .ele('coordinate', {x:req.body.x8RXDBroadcastCoordinateX, y:req.body.x8RXDBroadcastCoordinateY}).txt('8RXD').up()
          .ele('coordinate', {x:req.body.x9LSBroadcastCoordinateX, y:req.body.x9LSBroadcastCoordinateY}).txt('9LS').up()
          .ele('coordinate', {x:req.body.x9LMBroadcastCoordinateX, y:req.body.x9LMBroadcastCoordinateY}).txt('9LM').up()
          .ele('coordinate', {x:req.body.x9LDBroadcastCoordinateX, y:req.body.x9LDBroadcastCoordinateY}).txt('9LD').up()
          .ele('coordinate', {x:req.body.x9SBroadcastCoordinateX, y:req.body.x9SBroadcastCoordinateY}).txt('9S').up()
          .ele('coordinate', {x:req.body.x9MBroadcastCoordinateX, y:req.body.x9MBroadcastCoordinateY}).txt('9M').up()
          .ele('coordinate', {x:req.body.x9DBroadcastCoordinateX, y:req.body.x9DBroadcastCoordinateY}).txt('9D').up()
          .ele('coordinate', {x:req.body.x89SBroadcastCoordinateX, y:req.body.x89SBroadcastCoordinateY}).txt('89S').up()
          .ele('coordinate', {x:req.body.x89MBroadcastCoordinateX, y:req.body.x89MBroadcastCoordinateY}).txt('89M').up()
          .ele('coordinate', {x:req.body.x89DBroadcastCoordinateX, y:req.body.x89DBroadcastCoordinateY}).txt('89D').up()
          .ele('coordinate', {x:req.body.x89DBroadcastCoordinateX, y:req.body.x89DBroadcastCoordinateY}).txt('89XD').up()
          .ele('coordinate', {x:req.body.x3BroadcastCoordinateX, y:req.body.x3BroadcastCoordinateY}).txt('3').up()
          .ele('coordinate', {x:req.body.x4BroadcastCoordinateX, y:req.body.x4BroadcastCoordinateY}).txt('4').up()
          .ele('coordinate', {x:req.body.x5BroadcastCoordinateX, y:req.body.x5BroadcastCoordinateY}).txt('5').up()
          .ele('coordinate', {x:req.body.x6BroadcastCoordinateX, y:req.body.x6BroadcastCoordinateY}).txt('6').up()
          .ele('coordinate', {x:req.body.x13BroadcastCoordinateX, y:req.body.x13BroadcastCoordinateY}).txt('13').up()
          .ele('coordinate', {x:req.body.x15BroadcastCoordinateX, y:req.body.x15BroadcastCoordinateY}).txt('15').up()
          .ele('coordinate', {x:req.body.x23BroadcastCoordinateX, y:req.body.x23BroadcastCoordinateY}).txt('23').up()
          .ele('coordinate', {x:req.body.x25BroadcastCoordinateX, y:req.body.x25BroadcastCoordinateY}).txt('25').up()
          .ele('coordinate', {x:req.body.x34BroadcastCoordinateX, y:req.body.x34BroadcastCoordinateY}).txt('34').up()
          .ele('coordinate', {x:req.body.x56BroadcastCoordinateX, y:req.body.x56BroadcastCoordinateY}).txt('56').up()
          .ele('coordinate', {x:req.body.x13SBroadcastCoordinateX, y:req.body.x13SBroadcastCoordinateY}).txt('13S').up()
          .ele('coordinate', {x:req.body.x15SBroadcastCoordinateX, y:req.body.x15SBroadcastCoordinateY}).txt('15S').up()
          .ele('coordinate', {x:req.body.x2LBroadcastCoordinateX, y:req.body.x2LBroadcastCoordinateY}).txt('2L').up()
          .ele('coordinate', {x:req.body.x2RBroadcastCoordinateX, y:req.body.x2RBroadcastCoordinateY}).txt('2R').up()
          .ele('coordinate', {x:req.body.x34DBroadcastCoordinateX, y:req.body.x34DBroadcastCoordinateY}).txt('34D').up()
          .ele('coordinate', {x:req.body.x34SBroadcastCoordinateX, y:req.body.x34SBroadcastCoordinateY}).txt('34S').up()
          .ele('coordinate', {x:req.body.x3DBroadcastCoordinateX, y:req.body.x3DBroadcastCoordinateY}).txt('3D').up()
          .ele('coordinate', {x:req.body.x3LBroadcastCoordinateX, y:req.body.x3LBroadcastCoordinateY}).txt('3L').up()
          .ele('coordinate', {x:req.body.x3SBroadcastCoordinateX, y:req.body.x3SBroadcastCoordinateY}).txt('3S').up()
          .ele('coordinate', {x:req.body.x4DBroadcastCoordinateX, y:req.body.x4DBroadcastCoordinateY}).txt('4D').up()
          .ele('coordinate', {x:req.body.x4MBroadcastCoordinateX, y:req.body.x4MBroadcastCoordinateY}).txt('4M').up()
          .ele('coordinate', {x:req.body.x4MDBroadcastCoordinateX, y:req.body.x4MDBroadcastCoordinateY}).txt('4MD').up()
          .ele('coordinate', {x:req.body.x4MSBroadcastCoordinateX, y:req.body.x4MSBroadcastCoordinateY}).txt('4MS').up()
          .ele('coordinate', {x:req.body.x4SBroadcastCoordinateX, y:req.body.x4SBroadcastCoordinateY}).txt('4S').up()
          .ele('coordinate', {x:req.body.x56DBroadcastCoordinateX, y:req.body.x56DBroadcastCoordinateY}).txt('56D').up()
          .ele('coordinate', {x:req.body.x56SBroadcastCoordinateX, y:req.body.x56SBroadcastCoordinateY}).txt('56S').up()
          .ele('coordinate', {x:req.body.x5DBroadcastCoordinateX, y:req.body.x5DBroadcastCoordinateY}).txt('5D').up()
          .ele('coordinate', {x:req.body.x5LBroadcastCoordinateX, y:req.body.x5LBroadcastCoordinateY}).txt('5L').up()
          .ele('coordinate', {x:req.body.x5SBroadcastCoordinateX, y:req.body.x5SBroadcastCoordinateY}).txt('5S').up()
          .ele('coordinate', {x:req.body.x6DBroadcastCoordinateX, y:req.body.x6DBroadcastCoordinateY}).txt('6D').up()
          .ele('coordinate', {x:req.body.x6MBroadcastCoordinateX, y:req.body.x6MBroadcastCoordinateY}).txt('6M').up()
          .ele('coordinate', {x:req.body.x6MDBroadcastCoordinateX, y:req.body.x6MDBroadcastCoordinateY}).txt('6MD').up()
          .ele('coordinate', {x:req.body.x6MSBroadcastCoordinateX, y:req.body.x6MSBroadcastCoordinateY}).txt('6MS').up()
          .ele('coordinate', {x:req.body.x6SBroadcastCoordinateX, y:req.body.x6SBroadcastCoordinateY}).txt('6S').up()
          .ele('coordinate', {x:req.body.xHPBroadcastCoordinateX, y:req.body.xHPBroadcastCoordinateY}).txt('HP').up()
          .ele('coordinate', {x:req.body.x2FBroadcastCoordinateX, y:req.body.x2FBroadcastCoordinateY}).txt('2F').up()
          .ele('coordinate', {x:req.body.x2LFBroadcastCoordinateX, y:req.body.x2LFBroadcastCoordinateY}).txt('2LF').up()
          .ele('coordinate', {x:req.body.x2RFBroadcastCoordinateX, y:req.body.x2RFBroadcastCoordinateY}).txt('2RF').up()
          .ele('coordinate', {x:req.body.x5DFBroadcastCoordinateX, y:req.body.x5DFBroadcastCoordinateY}).txt('5DF').up()
          .ele('coordinate', {x:req.body.x3DFBroadcastCoordinateX, y:req.body.x3DFBroadcastCoordinateY}).txt('3DF').up()
          .ele('coordinate', {x:req.body.x5FBroadcastCoordinateX, y:req.body.x5FBroadcastCoordinateY}).txt('5F').up()
          .ele('coordinate', {x:req.body.x3FBroadcastCoordinateX, y:req.body.x3FBroadcastCoordinateY}).txt('3F').up()
          .ele('coordinate', {x:req.body.x5SFBroadcastCoordinateX, y:req.body.x5SFBroadcastCoordinateY}).txt('5SF').up()
          .ele('coordinate', {x:req.body.x3SFBroadcastCoordinateX, y:req.body.x3SFBroadcastCoordinateY}).txt('3SF').up()
          .ele('coordinate', {x:req.body.x25FBroadcastCoordinateX, y:req.body.x25FBroadcastCoordinateY}).txt('25F').up()
          .ele('coordinate', {x:req.body.x23FBroadcastCoordinateX, y:req.body.x23FBroadcastCoordinateY}).txt('23F').up()
          .ele('coordinate', {x:req.body.x7LDBroadcastCoordinateX, y:req.body.x7LDBroadcastCoordinateY}).txt('7LD').up()
          .ele('coordinate', {x:req.body.x7LMBroadcastCoordinateX, y:req.body.x7LMBroadcastCoordinateY}).txt('7LM').up()
          .ele('coordinate', {x:req.body.x7LSBroadcastCoordinateX, y:req.body.x7LSBroadcastCoordinateY}).txt('7LS').up()
          .ele('coordinate', {x:req.body.x9LDBroadcastCoordinateX, y:req.body.x9LDBroadcastCoordinateY}).txt('9LD').up()
          .ele('coordinate', {x:req.body.x9LMBroadcastCoordinateX, y:req.body.x9LMBroadcastCoordinateY}).txt('9LM').up()
          .ele('coordinate', {x:req.body.x9LSBroadcastCoordinateX, y:req.body.x9LSBroadcastCoordinateY}).txt('9LS').up()
        .up()
        .ele('DiagramBallCoordinates')
          .ele('coordinate', {x:req.body.xWLLWebcastCoordinateX, y:req.body.xWLLWebcastCoordinateY}).txt('WLL').up()
          .ele('coordinate', {x:req.body.xWLWebcastCoordinateX, y:req.body.xWLWebcastCoordinateY}).txt('W L').up()
          .ele('coordinate', {x:req.body.xWLCWebcastCoordinateX, y:req.body.xWLCWebcastCoordinateY}).txt('WLC').up()
          .ele('coordinate', {x:req.body.xWCWebcastCoordinateX, y:req.body.xWCWebcastCoordinateY}).txt('W C').up()
          .ele('coordinate', {x:req.body.xWRCWebcastCoordinateX, y:req.body.xWRCWebcastCoordinateY}).txt('WRC').up()
          .ele('coordinate', {x:req.body.xWRWebcastCoordinateX, y:req.body.xWRWebcastCoordinateY}).txt('W R').up()
          .ele('coordinate', {x:req.body.xWRLWebcastCoordinateX, y:req.body.xWRLWebcastCoordinateY}).txt('WRL').up()
          .ele('coordinate', {x:req.body.x7LSWebcastCoordinateX, y:req.body.x7LSWebcastCoordinateY}).txt('7LS').up()
          .ele('coordinate', {x:req.body.x7LMWebcastCoordinateX, y:req.body.x7LMWebcastCoordinateY}).txt('7LM').up()
          .ele('coordinate', {x:req.body.x7LDWebcastCoordinateX, y:req.body.x7LDWebcastCoordinateY}).txt('7LD').up()
          .ele('coordinate', {x:req.body.x7SWebcastCoordinateX, y:req.body.x7SWebcastCoordinateY}).txt('7S').up()
          .ele('coordinate', {x:req.body.x7MWebcastCoordinateX, y:req.body.x7MWebcastCoordinateY}).txt('7M').up()
          .ele('coordinate', {x:req.body.x7DWebcastCoordinateX, y:req.body.x7DWebcastCoordinateY}).txt('7D').up()
          .ele('coordinate', {x:req.body.x78SWebcastCoordinateX, y:req.body.x78SWebcastCoordinateY}).txt('78S').up()
          .ele('coordinate', {x:req.body.x78MWebcastCoordinateX, y:req.body.x78MWebcastCoordinateY}).txt('78M').up()
          .ele('coordinate', {x:req.body.x78DWebcastCoordinateX, y:req.body.x78DWebcastCoordinateY}).txt('78D').up()
          .ele('coordinate', {x:req.body.x78XDWebcastCoordinateX, y:req.body.x78XDWebcastCoordinateY}).txt('78XD').up()
          .ele('coordinate', {x:req.body.x8LSWebcastCoordinateX, y:req.body.x8LSWebcastCoordinateY}).txt('8LS').up()
          .ele('coordinate', {x:req.body.x8LMWebcastCoordinateX, y:req.body.x8LMWebcastCoordinateY}).txt('8LM').up()
          .ele('coordinate', {x:req.body.x8LDWebcastCoordinateX, y:req.body.x8LDWebcastCoordinateY}).txt('8LD').up()
          .ele('coordinate', {x:req.body.x8LXDWebcastCoordinateX, y:req.body.x8LXDWebcastCoordinateY}).txt('8LXD').up()
          .ele('coordinate', {x:req.body.x8RSWebcastCoordinateX, y:req.body.x8RSWebcastCoordinateY}).txt('8RS').up()
          .ele('coordinate', {x:req.body.x8RMWebcastCoordinateX, y:req.body.x8RMWebcastCoordinateY}).txt('8RM').up()
          .ele('coordinate', {x:req.body.x8RDWebcastCoordinateX, y:req.body.x8RDWebcastCoordinateY}).txt('8RD').up()
          .ele('coordinate', {x:req.body.x8RXDWebcastCoordinateX, y:req.body.x8RXDWebcastCoordinateY}).txt('8RXD').up()
          .ele('coordinate', {x:req.body.x9LSWebcastCoordinateX, y:req.body.x9LSWebcastCoordinateY}).txt('9LS').up()
          .ele('coordinate', {x:req.body.x9LMWebcastCoordinateX, y:req.body.x9LMWebcastCoordinateY}).txt('9LM').up()
          .ele('coordinate', {x:req.body.x9LDWebcastCoordinateX, y:req.body.x9LDWebcastCoordinateY}).txt('9LD').up()
          .ele('coordinate', {x:req.body.x9SWebcastCoordinateX, y:req.body.x9SWebcastCoordinateY}).txt('9S').up()
          .ele('coordinate', {x:req.body.x9MWebcastCoordinateX, y:req.body.x9MWebcastCoordinateY}).txt('9M').up()
          .ele('coordinate', {x:req.body.x9DWebcastCoordinateX, y:req.body.x9DWebcastCoordinateY}).txt('9D').up()
          .ele('coordinate', {x:req.body.x89SWebcastCoordinateX, y:req.body.x89SWebcastCoordinateY}).txt('89S').up()
          .ele('coordinate', {x:req.body.x89MWebcastCoordinateX, y:req.body.x89MWebcastCoordinateY}).txt('89M').up()
          .ele('coordinate', {x:req.body.x89DWebcastCoordinateX, y:req.body.x89DWebcastCoordinateY}).txt('89D').up()
          .ele('coordinate', {x:req.body.x89DWebcastCoordinateX, y:req.body.x89DWebcastCoordinateY}).txt('89XD').up()
          .ele('coordinate', {x:req.body.x3WebcastCoordinateX, y:req.body.x3WebcastCoordinateY}).txt('3').up()
          .ele('coordinate', {x:req.body.x4WebcastCoordinateX, y:req.body.x4WebcastCoordinateY}).txt('4').up()
          .ele('coordinate', {x:req.body.x5WebcastCoordinateX, y:req.body.x5WebcastCoordinateY}).txt('5').up()
          .ele('coordinate', {x:req.body.x6WebcastCoordinateX, y:req.body.x6WebcastCoordinateY}).txt('6').up()
          .ele('coordinate', {x:req.body.x13WebcastCoordinateX, y:req.body.x13WebcastCoordinateY}).txt('13').up()
          .ele('coordinate', {x:req.body.x15WebcastCoordinateX, y:req.body.x15WebcastCoordinateY}).txt('15').up()
          .ele('coordinate', {x:req.body.x23WebcastCoordinateX, y:req.body.x23WebcastCoordinateY}).txt('23').up()
          .ele('coordinate', {x:req.body.x25WebcastCoordinateX, y:req.body.x25WebcastCoordinateY}).txt('25').up()
          .ele('coordinate', {x:req.body.x34WebcastCoordinateX, y:req.body.x34WebcastCoordinateY}).txt('34').up()
          .ele('coordinate', {x:req.body.x56WebcastCoordinateX, y:req.body.x56WebcastCoordinateY}).txt('56').up()
          .ele('coordinate', {x:req.body.x13SWebcastCoordinateX, y:req.body.x13SWebcastCoordinateY}).txt('13S').up()
          .ele('coordinate', {x:req.body.x15SWebcastCoordinateX, y:req.body.x15SWebcastCoordinateY}).txt('15S').up()
          .ele('coordinate', {x:req.body.x2LWebcastCoordinateX, y:req.body.x2LWebcastCoordinateY}).txt('2L').up()
          .ele('coordinate', {x:req.body.x2RWebcastCoordinateX, y:req.body.x2RWebcastCoordinateY}).txt('2R').up()
          .ele('coordinate', {x:req.body.x34DWebcastCoordinateX, y:req.body.x34DWebcastCoordinateY}).txt('34D').up()
          .ele('coordinate', {x:req.body.x34SWebcastCoordinateX, y:req.body.x34SWebcastCoordinateY}).txt('34S').up()
          .ele('coordinate', {x:req.body.x3DWebcastCoordinateX, y:req.body.x3DWebcastCoordinateY}).txt('3D').up()
          .ele('coordinate', {x:req.body.x3LWebcastCoordinateX, y:req.body.x3LWebcastCoordinateY}).txt('3L').up()
          .ele('coordinate', {x:req.body.x3SWebcastCoordinateX, y:req.body.x3SWebcastCoordinateY}).txt('3S').up()
          .ele('coordinate', {x:req.body.x4DWebcastCoordinateX, y:req.body.x4DWebcastCoordinateY}).txt('4D').up()
          .ele('coordinate', {x:req.body.x4MWebcastCoordinateX, y:req.body.x4MWebcastCoordinateY}).txt('4M').up()
          .ele('coordinate', {x:req.body.x4MDWebcastCoordinateX, y:req.body.x4MDWebcastCoordinateY}).txt('4MD').up()
          .ele('coordinate', {x:req.body.x4MSWebcastCoordinateX, y:req.body.x4MSWebcastCoordinateY}).txt('4MS').up()
          .ele('coordinate', {x:req.body.x4SWebcastCoordinateX, y:req.body.x4SWebcastCoordinateY}).txt('4S').up()
          .ele('coordinate', {x:req.body.x56DWebcastCoordinateX, y:req.body.x56DWebcastCoordinateY}).txt('56D').up()
          .ele('coordinate', {x:req.body.x56SWebcastCoordinateX, y:req.body.x56SWebcastCoordinateY}).txt('56S').up()
          .ele('coordinate', {x:req.body.x5DWebcastCoordinateX, y:req.body.x5DWebcastCoordinateY}).txt('5D').up()
          .ele('coordinate', {x:req.body.x5LWebcastCoordinateX, y:req.body.x5LWebcastCoordinateY}).txt('5L').up()
          .ele('coordinate', {x:req.body.x5SWebcastCoordinateX, y:req.body.x5SWebcastCoordinateY}).txt('5S').up()
          .ele('coordinate', {x:req.body.x6DWebcastCoordinateX, y:req.body.x6DWebcastCoordinateY}).txt('6D').up()
          .ele('coordinate', {x:req.body.x6MWebcastCoordinateX, y:req.body.x6MWebcastCoordinateY}).txt('6M').up()
          .ele('coordinate', {x:req.body.x6MDWebcastCoordinateX, y:req.body.x6MDWebcastCoordinateY}).txt('6MD').up()
          .ele('coordinate', {x:req.body.x6MSWebcastCoordinateX, y:req.body.x6MSWebcastCoordinateY}).txt('6MS').up()
          .ele('coordinate', {x:req.body.x6SWebcastCoordinateX, y:req.body.x6SWebcastCoordinateY}).txt('6S').up()
          .ele('coordinate', {x:req.body.xHPWebcastCoordinateX, y:req.body.xHPWebcastCoordinateY}).txt('HP').up()
          .ele('coordinate', {x:req.body.x2FWebcastCoordinateX, y:req.body.x2FWebcastCoordinateY}).txt('2F').up()
          .ele('coordinate', {x:req.body.x2LFWebcastCoordinateX, y:req.body.x2LFWebcastCoordinateY}).txt('2LF').up()
          .ele('coordinate', {x:req.body.x2RFWebcastCoordinateX, y:req.body.x2RFWebcastCoordinateY}).txt('2RF').up()
          .ele('coordinate', {x:req.body.x5DFWebcastCoordinateX, y:req.body.x5DFWebcastCoordinateY}).txt('5DF').up()
          .ele('coordinate', {x:req.body.x3DFWebcastCoordinateX, y:req.body.x3DFWebcastCoordinateY}).txt('3DF').up()
          .ele('coordinate', {x:req.body.x5FWebcastCoordinateX, y:req.body.x5FWebcastCoordinateY}).txt('5F').up()
          .ele('coordinate', {x:req.body.x3FWebcastCoordinateX, y:req.body.x3FWebcastCoordinateY}).txt('3F').up()
          .ele('coordinate', {x:req.body.x5SFWebcastCoordinateX, y:req.body.x5SFWebcastCoordinateY}).txt('5SF').up()
          .ele('coordinate', {x:req.body.x3SFWebcastCoordinateX, y:req.body.x3SFWebcastCoordinateY}).txt('3SF').up()
          .ele('coordinate', {x:req.body.x25FWebcastCoordinateX, y:req.body.x25FWebcastCoordinateY}).txt('25F').up()
          .ele('coordinate', {x:req.body.x23FWebcastCoordinateX, y:req.body.x23FWebcastCoordinateY}).txt('23F').up()
          .ele('coordinate', {x:req.body.x7LDWebcastCoordinateX, y:req.body.x7LDWebcastCoordinateY}).txt('7LD').up()
          .ele('coordinate', {x:req.body.x7LMWebcastCoordinateX, y:req.body.x7LMWebcastCoordinateY}).txt('7LM').up()
          .ele('coordinate', {x:req.body.x7LSWebcastCoordinateX, y:req.body.x7LSWebcastCoordinateY}).txt('7LS').up()
          .ele('coordinate', {x:req.body.x9LDWebcastCoordinateX, y:req.body.x9LDWebcastCoordinateY}).txt('9LD').up()
          .ele('coordinate', {x:req.body.x9LMWebcastCoordinateX, y:req.body.x9LMWebcastCoordinateY}).txt('9LM').up()
          .ele('coordinate', {x:req.body.x9LSWebcastCoordinateX, y:req.body.x9LSWebcastCoordinateY}).txt('9LS').up()
        .up()
    .up();

    const xml = root.end({ prettyPrint: true });

    var xmlBuffer = Buffer.from(xml, 'utf-8');

    Jimp.read(__dirname + '/images/dome.png', (err, fir_img) => {
      if(err) {
        console.log(err);
      } else {
          Jimp.read(buffer, (err, sec_img) => {
            if(err) {
              console.log(err);
            } else {
              sec_img.write(parkName+"_webcast.png")
              fir_img.composite(sec_img, 100, 0);
              fir_img.getBuffer(Jimp.MIME_PNG, (err, domeBuffer) => {
                Jimp.read(__dirname + '/images/day_bg.png', (err, fir_img) => {
                  if(err) {
                    console.log(err);
                  } else {
                      Jimp.read(buffer, (err, sec_img) => {
                        if(err) {
                          console.log(err);
                        } else {
                          fir_img.composite(sec_img, 100, 0);
                          fir_img.getBuffer(Jimp.MIME_PNG, (err, dayBuffer) => {
                            Jimp.read(__dirname + '/images/night_bg.png', (err, fir_img) => {
                              if(err) {
                                console.log(err);
                              } else {
                                  Jimp.read(buffer, (err, sec_img) => {
                                    if(err) {
                                      console.log(err);
                                    } else {
                                      fir_img.composite(sec_img, 100, 0);
                                      fir_img.getBuffer(Jimp.MIME_PNG, (err, nightBuffer) => {

                                        var output = fs.createWriteStream(tempDir + '/'+parkName+'.zip');
                                        
                                        output.on('close', function() {
                                          var data = fs.readFileSync(tempDir + '/'+parkName+'.zip');
                                          var saveOptions = {
                                            defaultPath: app.getPath('downloads') + '/' + parkName+'.zip',
                                          }
                                          dialog.showSaveDialog(null, saveOptions).then((result) => { 
                                            if (!result.canceled) {
                                              fs.writeFile(result.filePath, data, function(err) {
                                                if (err) {
                                                  res.end(err)
                                                  fs.unlink(tempDir + '/'+parkName+'.zip', (err) => {
                                                    if (err) {
                                                      console.error(err)
                                                      return
                                                    }
                                                  })
                                                } else {
                                                  fs.unlink(tempDir + '/'+parkName+'.zip', (err) => {
                                                    if (err) {
                                                      console.error(err)
                                                      return
                                                    }
                                                  })
                                                  res.end("success")
                                                };
                                              })
                                            } else {
                                              fs.unlink(tempDir + '/'+parkName+'.zip', (err) => {
                                                if (err) {
                                                  console.error(err)
                                                  return
                                                }
                                              })
                                              res.end("success");
                                            }
                                          })
                                        });

                                        const archive = archiver('zip', {
                                          zlib: { level: 9 } // Sets the compression level.
                                        });

                                        archive.on('error', function(err) {
                                          throw err;
                                        });

                                        archive.pipe(output);
                                        
                                        if (parkType == 'Dome') {
                                          archive.append(domeBuffer, {name: parkName+'_dome.png'})
                                        } else {
                                          archive.append(dayBuffer, { name: parkName+'_day.png' });
                                          archive.append(nightBuffer, { name: parkName+'_night.png' });
                                        }
                                        archive.append(buffer, { name: parkName+"_webcast.png" });
                                        archive.append(xmlBuffer, { name: parkName+".xml" });
                                        archive.append(txtBuffer, { name: 'readme.txt' });
                                        archive.finalize();
                                        
                                      })
                                    }
                                  })
                                }
                              });
                          })
                        }
                      })
                    }
                  });
                })
            }
          })
        }
      });
})

const createWindow = () => {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 875,
    icon: (__dirname + '/images/ballpark.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js')
    }
  })

  // and load the index.html of the app.
  mainWindow.loadFile('index.html')

  mainWindow.webContents.on('new-window', function(e, url) {
    e.preventDefault();
    require('electron').shell.openExternal(url);
  });

  // Open the DevTools.
  // mainWindow.webContents.openDevTools()
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.

function round(value, precision) {
  var multiplier = Math.pow(10, precision || 0);
  return Math.round(value * multiplier) / multiplier;
}