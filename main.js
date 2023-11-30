// main.js

// Modules to control application life and create native browser window
const { app, BrowserWindow, dialog,  Menu, shell, ipcMain } = require('electron')
const path = require('path')
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
const increment = require('add-filename-increment');
const Store = require("electron-store")

const store = new Store();

let db;

initSqlJs().then(function(SQL){
  db = new SQL.Database(filebuffer);
});

ipcMain.on('get-countries', (event, arg) => {
  let output = [];
  output.push("United States of America");
  db.each('SELECT distinct Country from weather WHERE Country <> "United States of America" order by Country asc',
    function (row){output.push(row.Country)}
  );
  event.sender.send('get-countries-response',JSON.stringify(output))
})

ipcMain.on('get-states', (event, arg) => {
  let result = db.exec('SELECT count(State) as count from weather where Country = "'+arg.country +'"  and length(State) > 0')
  let count = parseInt(result[0].values[0][0])
  if (count < 1) {
    event.sender.send('get-states-response',{count: count, states: null})
  } else {
    let output = [];
    db.each('SELECT distinct State from weather WHERE Country = "'+arg.country+'" order by Country asc',
      function (row){output.push(row.State)}
    );
    event.sender.send('get-states-response', {count: count, states: JSON.stringify(output)});
  }
})

ipcMain.on('get-cities', (event, arg) => {
  let output = []
  if (arg.state == null) {
    db.each('SELECT distinct City from weather WHERE Country = "'+arg.country+'" order by City asc',
      function (row){output.push(row.City)}
    );
  } else {
    db.each('SELECT distinct City from weather WHERE Country = "'+arg.country+'" and State = "'+arg.state+'" order by City asc',
      function (row){output.push(row.City)}
    );
  }
  event.sender.send('get-cities-response', JSON.stringify(output))
})

ipcMain.on('get-weather', (event, arg) => {
  let output = []
  let sql
  if (arg.state == null) {
    sql = 'select * from weather where City = "'+arg.city+'" and Country = "'+arg.country+'"'
  } else {
    sql = 'select * from weather where City = "'+arg.city+'" and State = "'+arg.state+'" and Country = "'+arg.country+'"'
  }
  db.each(sql,
    function (row){output.push(row)}
  );
  event.sender.send('get-weather-response', output);
})

ipcMain.on('random-park-name', (event, arg) => {
  let sql, sql2, output;
  let start = getRandomIntInclusive(5, 15)
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
  event.sender.send('random-park-name-response', output)
})

ipcMain.on('random-park', (event, arg) => {
  let sql, sql2, output, parkName, city;
  let cities = []
  let states = []
  let countries = []
  let start = getRandomIntInclusive(5, 15)
  if (start < 11) {
    sql = 'SELECT a.name, b.parkType FROM parkNames a inner join parkType b ORDER BY RANDOM() LIMIT 1';
    db.each(sql,
      function (row){parkName = row.name+' '+row.parkType}
    );
    if (start == 6) {
      sql2 = "SELECT a.streetName, b.streetType FROM streetNames a inner join streetType b ORDER BY RANDOM() LIMIT 1";
      db.each(sql2,
        function (row){parkName += ' at '+row.streetName+' '+row.streetType}
      );
    }
  } else {
    sql = "SELECT a.streetName, b.streetType, c.parkType FROM streetNames a inner join streetType b inner join parkType c ORDER BY RANDOM() LIMIT 1";
    db.each(sql,
      function (row){parkName = row.streetName+' '+row.streetType+' '+row.parkType}
    );
  }
  db.each('SELECT * FROM weather where Country = "United States of America" ORDER BY RANDOM() LIMIT 1',
    function (row){city = row}
  )
  db.each('SELECT distinct Country from weather WHERE Country <> "United States of America" order by Country asc',
    function (row){countries.push(row.Country)}
  );
  db.each('SELECT distinct State from weather WHERE Country = "United States of America" order by State asc',
    function (row){states.push(row.State)}
  )
  db.each('SELECT distinct City from weather WHERE Country = "United States of America" and State = "' + city.State + '" order by City asc',
    function (row){cities.push(row.City)}
  )

  event.sender.send('random-park-response', {
    parkName: parkName,
    city: city,
    countries: countries,
    states: states,
    cities: cities
  })
})

function getRandomIntInclusive(min, max) {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min + 1) + min); //The maximum is inclusive and the minimum is inclusive
}

ipcMain.on('calculate-factors', (event, arg) => {
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
  let dLLW = (LLW > 11) ? LLW : 11;
  let LFW = parseInt(arg.leftFieldWall);
  let dLFW = (LFW > 11) ? LFW : 11;
  let LCW = parseInt(arg.leftCenterWall);
  let dLCW = (LCW > 11) ? LCW : 11;
  let CFW = parseInt(arg.centerFieldWall);
  let dCFW = (CFW > 11) ? CFW : 11;
  let RCW = parseInt(arg.rightCenterWall);
  let dRCW = (RCW > 11) ? RCW : 11;
  let RFW = parseInt(arg.rightFieldWall);
  let dRFW = (RFW > 11) ? RFW : 11;
  let RLW = parseInt(arg.rightLineWall);
  let dRLW = (RLW > 11) ? RLW : 11;
  let carryL = parseInt(arg.carL);
  let carryC = parseInt(arg.carC);
  let carryR = parseInt(arg.carR);
  let AltitudeFactor = 1.8;

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

  if (Altitude != 0) {
    if (2 * (Math.sqrt(Altitude / 100) - 1 + 100 / 100) - 4 > 0) {
        AltitudeFactor = 2 * (2 * (Math.sqrt(Altitude / 100) - 1 + 100 / 100) - 4);
    } else {
        AltitudeFactor = 2 * (Math.sqrt(Altitude / 100) - 1 + 100 / 100) - 4;
    }
  }

  AltitudeFactor = round(AltitudeFactor,1)

  let LBA = (+(100)-((RL-330)/3)-((RF-360)/5)-((RC-390)/7)-((CF-405)/10)+Surface-FoulArea+((carryR+AltitudeFactor-1.798)/2)+((carryC+AltitudeFactor-1.798)/4)+((RL+RF+RC+CF-1485)/7))/100;
	let RBA = (+(100)-((LL-330)/3)-((LF-360)/5)-((LC-390)/7)-((CF-405)/10)+Surface-FoulArea+((carryL+AltitudeFactor-1.798)/2)+((carryC+AltitudeFactor-1.798)/4)+((LL+LF+LC+CF-1485)/7))/100;
	let Doubles = (100+(((((LC+RC+CF)-1185)*0.06))+(((LL+RL)-660)*0.325)+(((dLLW+dLFW+dLCW+dRCW+dRFW+dRLW-66)/6)*2.2)))/100;
	let Triples = (((+(100)+((LL-330)/2.5)+((CF-405)/8)+((RL-330)/16)+((LC-390)/11)+((RC-390)/12))/100)+(((AltitudeFactor-1.798)*0.0225)/2)+((((carryL*0.16)+(carryC*0.5)+(carryR*0.34))*0.06)/2))*(1+(Surface*0.089));
	let LHR = ((+(100)-((RL-330)/1.5)-((RF-360)/2.75)-((RC-390)/7)-((CF-405)/21)-((LC-390)/30)-(((RLW*2.658)+(RFW*1.45)+(RCW*0.57)+(CFW*0.19)+(LCW*0.133)-55)/7.5))/100)+((AltitudeFactor-1.798)*0.0225)+((((carryR*1.567)+(carryC*0.275))/1.842)*0.06);
	let RHR = ((+(100)-((LL-330)/1.5)-((LF-360)/2.75)-((LC-390)/7)-((CF-405)/21)-((RC-390)/30)-(((LLW*2.658)+(LFW*1.45)+(LCW*0.57)+(CFW*0.19)+(RCW*0.133)-55)/7.5))/100)+((AltitudeFactor-1.798)*0.0225)+((((carryL*1.567)+(carryC*0.275))/1.842)*0.06);

  let arr = {
    "avgLHB": (Math.round(LBA * 1000) / 1000).toFixed(3),
    "avgRHB": (Math.round(RBA * 1000) / 1000).toFixed(3),
    "doubles": (Math.round(Doubles * 1000) / 1000).toFixed(3),
    "triples": (Math.round(Triples * 1000) / 1000).toFixed(3),
    "hrLHB": (Math.round(LHR * 1000) / 1000).toFixed(3),
    "hrRHB": (Math.round(RHR * 1000) / 1000).toFixed(3)
  }

  event.sender.send('calculate-factors-response', arr)
})

ipcMain.on('get-template', (event, arg) => {
  var data = fs.readFileSync(__dirname + '/MowPatternTemplate.zip');
  var saveOptions = {
    defaultPath: app.getPath('downloads') + '/MowPatternTemplate.zip',
  }
  dialog.showSaveDialog(null, saveOptions).then((result) => { 
    if (!result.canceled) {
      fs.writeFile(result.filePath, data, function(err) {
        if (err) {
          dialog.showMessageBox(null, {
            type: 'error',
            message: "An error occurred:\r\n\r\n"+err
          })
        } 
      })
    }
  })
})

ipcMain.on('save-ballpark', (event, arg) => {
  let parkName = arg.ballparkName;
  let parkType, parkSurface, dayBGImage, foulArea, avg, hr, webcastBuffer, nightBuffer, dayBuffer, domeBuffer, txtBuffer, xmlBuffer;
  let txt = "Night background image modifed from \"Progressive Field Stadium Lights\" by laffy4k (http://www.flickr.com/photos/laffy4k/), used by Creative Commons 2.0 License\r\n\r\nDay background image modified from \"Mike Redmond\" by Wendy Berry (https://www.flickr.com/photos/twodolla/), used by Creative Commons 2.0 License\r\n";
  
  if (parkName.length < 1) { parkName = 'Unnamed_Ballpark' }
  parkName = parkName.replace(/[^a-zA-Z0-9]/g, "_");

  let buffer = Buffer.from(arg.imagedata.replace(/^data:image\/(png|gif|jpeg);base64,/,''), 'base64');

  switch (arg.ballparkType) {
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

  switch(arg.ballparkSurface) {
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

  switch(arg.ballparkFoulArea) {
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
  
  avg = round((parseFloat(arg.avgLHB) * 2 + parseFloat(arg.avgRHB)) / 3, 3).toFixed(3);
  hr = round((parseFloat(arg.hrRHB) * 2 + parseFloat(arg.hrLHB)) / 3, 3).toFixed(3);

  const root = create({ version: '1.0' })
    .ele('ballpark')
      .ele('BasicInformation')
        .ele('ballparkName').txt(xmlescape(arg.ballparkName)).up()
        .ele('ballparkCountry').txt(xmlescape(arg.ballparkCountry)).up()
        .ele('ballparkState').txt(xmlescape(arg.ballparkState)).up()
        .ele('ballparkCity').txt(xmlescape(arg.ballparkCity)).up()
        .ele('ballparkType').txt(parkType).up()
        .ele('ballparkSurface').txt(parkSurface).up()
        .ele('ballparkFoulArea').txt(foulArea).up()
        .ele('ballparkAltitude').txt(arg.ballparkAltitude).up()
        .ele('ballparkCapacity').txt(arg.ballparkCapacity).up()
      .up()
      .ele('BallparkDimensions')
        .ele('dimension', {distance: arg.leftLine, height: arg.leftLineWall}).txt('Left Field Line').up()
        .ele('dimension', {distance: arg.leftField, height: arg.leftFieldWall}).txt('Left Field').up()
        .ele('dimension', {distance: arg.leftCenter, height: arg.leftCenterWall}).txt('Left Center').up()
        .ele('dimension', {distance: arg.centerField, height: arg.centerFieldWall}).txt('Center Field').up()
        .ele('dimension', {distance: arg.rightCenter, height: arg.rightCenterWall}).txt('Right Center').up()
        .ele('dimension', {distance: arg.rightField, height: arg.rightFieldWall}).txt('Right Field').up()
        .ele('dimension', {distance: arg.rightLine, height: arg.rightLineWall}).txt('Right Field Line').up()
      .up() 
      .ele('BallparkFactors')
        .ele('factor', {value: arg.avgLHB}).txt('avgLHB').up()
        .ele('factor', {value: arg.avgRHB}).txt('avgRHB').up()
        .ele('factor', {value: arg.doubles}).txt('doubles').up()
        .ele('factor', {value: arg.triples}).txt('triples').up()
        .ele('factor', {value: arg.hrLHB}).txt('hrLHB').up()
        .ele('factor', {value: arg.hrRHB}).txt('hrRHB').up()
        .ele('factor', {value: avg}).txt('Average').up()
        .ele('factor', {value: hr}).txt('Home Runs').up()
      .up()
      .ele('FieldOptions')
        .ele('MowPattern').txt(arg.mowPattern).up()
        .ele('PitchingLane').txt(arg.pitchingLane).up()
        .ele('InfieldType').txt(arg.infieldType).up()
        .ele('DistanceMarkers').txt(arg.distanceMarkers).up()
        .ele('OnDeckCircles').txt(arg.onDeckCircles).up()
      .up()
      .ele('WeatherInformation')
        .ele('month', {temperature: arg.JanTemp, precipitation: arg.JanRain}).txt('January').up()
        .ele('month', {temperature: arg.FebTemp, precipitation: arg.FebRain}).txt('February').up()
        .ele('month', {temperature: arg.MarTemp, precipitation: arg.MarRain}).txt('March').up()
        .ele('month', {temperature: arg.AprTemp, precipitation: arg.AprRain}).txt('April').up()
        .ele('month', {temperature: arg.MayTemp, precipitation: arg.MayRain}).txt('May').up()
        .ele('month', {temperature: arg.JunTemp, precipitation: arg.JunRain}).txt('June').up()
        .ele('month', {temperature: arg.JulTemp, precipitation: arg.JulRain}).txt('July').up()
        .ele('month', {temperature: arg.AugTemp, precipitation: arg.AugRain}).txt('August').up()
        .ele('month', {temperature: arg.SepTemp, precipitation: arg.SepRain}).txt('September').up()
        .ele('month', {temperature: arg.OctTemp, precipitation: arg.OctRain}).txt('October').up()
        .ele('month', {temperature: arg.NovTemp, precipitation: arg.NovRain}).txt('November').up()
        .ele('month', {temperature: arg.DecTemp, precipitation: arg.DecRain}).txt('December').up()
        .ele('AverageWind').txt(arg.avgWind).up()
      .up()
      .ele('CalculatedWeatherFactors')
        .ele('AmbientTemperature').txt(arg.Ambient).up()
        .ele('AverageTemperature').txt(arg.avgTemp).up()
        .ele('AverageRain').txt(arg.avgRain).up()
        .ele('CarryLeft').txt(arg.carL).up()
        .ele('CarryCenter').txt(arg.carC).up()
        .ele('CarryRight').txt(arg.carR).up()
      .up()
      .ele('PlayerLocations')
        .ele('DayPlayerCoordinates')
          .ele('coordinate', {x:arg.PBroadcastCoordinateX, y:arg.PBroadcastCoordinateY,}).txt('Pitcher').up()
          .ele('coordinate', {x:arg.CBroadcastCoordinateX, y:arg.CBroadcastCoordinateY,}).txt('Catcher').up()
          .ele('coordinate', {x:arg.a1BBroadcastCoordinateX, y:arg.a1BBroadcastCoordinateX,}).txt('First Baseman').up()
          .ele('coordinate', {x:arg.a2BBroadcastCoordinateX, y:arg.a2BBroadcastCoordinateX,}).txt('Second Baseman').up()
          .ele('coordinate', {x:arg.SSBroadcastCoordinateX, y:arg.SSBroadcastCoordinateX,}).txt('Shortstop').up()
          .ele('coordinate', {x:arg.a3BBroadcastCoordinateX, y:arg.a3BBroadcastCoordinateX,}).txt('Third Baseman').up()
          .ele('coordinate', {x:arg.LFBroadcastCoordinateX, y:arg.LFBroadcastCoordinateX,}).txt('Left Fielder').up()
          .ele('coordinate', {x:arg.CFBroadcastCoordinateX, y:arg.CFBroadcastCoordinateX,}).txt('Center Fielder').up()
          .ele('coordinate', {x:arg.RFBroadcastCoordinateX, y:arg.RFBroadcastCoordinateX,}).txt('Right Fielder').up()
          .ele('coordinate', {x:arg.R1BroadcastCoordinateX, y:arg.R1BroadcastCoordinateX,}).txt('Runner on 1st').up()
          .ele('coordinate', {x:arg.R2BroadcastCoordinateX, y:arg.R2BroadcastCoordinateX,}).txt('Runner on 2nd').up()
          .ele('coordinate', {x:arg.R3BroadcastCoordinateX, y:arg.R3BroadcastCoordinateX,}).txt('Runner on 3rd').up()
          .ele('coordinate', {x:arg.LHBBroadcastCoordinateX, y:arg.LHBBroadcastCoordinateX,}).txt('Lefty Batter').up()
          .ele('coordinate', {x:arg.RHBBroadcastCoordinateX, y:arg.RHBBroadcastCoordinateX,}).txt('Righty Batter').up()
        .up()
        .ele('NightPlayerCoordinates')
          .ele('coordinate', {x:arg.PBroadcastCoordinateX, y:arg.PBroadcastCoordinateY,}).txt('Pitcher').up()
          .ele('coordinate', {x:arg.CBroadcastCoordinateX, y:arg.CBroadcastCoordinateY,}).txt('Catcher').up()
          .ele('coordinate', {x:arg.a1BBroadcastCoordinateX, y:arg.a1BBroadcastCoordinateX,}).txt('First Baseman').up()
          .ele('coordinate', {x:arg.a2BBroadcastCoordinateX, y:arg.a2BBroadcastCoordinateX,}).txt('Second Baseman').up()
          .ele('coordinate', {x:arg.SSBroadcastCoordinateX, y:arg.SSBroadcastCoordinateX,}).txt('Shortstop').up()
          .ele('coordinate', {x:arg.a3BBroadcastCoordinateX, y:arg.a3BBroadcastCoordinateX,}).txt('Third Baseman').up()
          .ele('coordinate', {x:arg.LFBroadcastCoordinateX, y:arg.LFBroadcastCoordinateX,}).txt('Left Fielder').up()
          .ele('coordinate', {x:arg.CFBroadcastCoordinateX, y:arg.CFBroadcastCoordinateX,}).txt('Center Fielder').up()
          .ele('coordinate', {x:arg.RFBroadcastCoordinateX, y:arg.RFBroadcastCoordinateX,}).txt('Right Fielder').up()
          .ele('coordinate', {x:arg.R1BroadcastCoordinateX, y:arg.R1BroadcastCoordinateX,}).txt('Runner on 1st').up()
          .ele('coordinate', {x:arg.R2BroadcastCoordinateX, y:arg.R2BroadcastCoordinateX,}).txt('Runner on 2nd').up()
          .ele('coordinate', {x:arg.R3BroadcastCoordinateX, y:arg.R3BroadcastCoordinateX,}).txt('Runner on 3rd').up()
          .ele('coordinate', {x:arg.LHBBroadcastCoordinateX, y:arg.LHBBroadcastCoordinateX,}).txt('Lefty Batter').up()
          .ele('coordinate', {x:arg.RHBBroadcastCoordinateX, y:arg.RHBBroadcastCoordinateX,}).txt('Righty Batter').up()
        .up()
        .ele('DiagramPlayerCoordinates')       
          .ele('coordinate', {x:arg.PWebcastCoordinateX, y:arg.PWebcastCoordinateY,}).txt('Pitcher').up()
          .ele('coordinate', {x:arg.CWebcastCoordinateX, y:arg.CWebcastCoordinateY,}).txt('Catcher').up()
          .ele('coordinate', {x:arg.a1BWebcastCoordinateX, y:arg.a1BWebcastCoordinateX,}).txt('First Baseman').up()
          .ele('coordinate', {x:arg.a2BWebcastCoordinateX, y:arg.a2BWebcastCoordinateX,}).txt('Second Baseman').up()
          .ele('coordinate', {x:arg.SSWebcastCoordinateX, y:arg.SSWebcastCoordinateX,}).txt('Shortstop').up()
          .ele('coordinate', {x:arg.a3BWebcastCoordinateX, y:arg.a3BWebcastCoordinateX,}).txt('Third Baseman').up()
          .ele('coordinate', {x:arg.LFWebcastCoordinateX, y:arg.LFWebcastCoordinateX,}).txt('Left Fielder').up()
          .ele('coordinate', {x:arg.CFWebcastCoordinateX, y:arg.CFWebcastCoordinateX,}).txt('Center Fielder').up()
          .ele('coordinate', {x:arg.RFWebcastCoordinateX, y:arg.RFWebcastCoordinateX,}).txt('Right Fielder').up()
          .ele('coordinate', {x:arg.R1WebcastCoordinateX, y:arg.R1WebcastCoordinateX,}).txt('Runner on 1st').up()
          .ele('coordinate', {x:arg.R2WebcastCoordinateX, y:arg.R2WebcastCoordinateX,}).txt('Runner on 2nd').up()
          .ele('coordinate', {x:arg.R3WebcastCoordinateX, y:arg.R3WebcastCoordinateX,}).txt('Runner on 3rd').up()
          .ele('coordinate', {x:arg.LHBWebcastCoordinateX, y:arg.LHBWebcastCoordinateX,}).txt('Lefty Batter').up()
          .ele('coordinate', {x:arg.RHBWebcastCoordinateX, y:arg.RHBWebcastCoordinateX,}).txt('Righty Batter').up()
        .up()
      .up()
      .ele('BallFlightCoordinates')
        .ele('DayBallCoordinates')
          .ele('coordinate', {x:arg.xWLLBroadcastCoordinateX, y:arg.xWLLBroadcastCoordinateY}).txt('WLL').up()
          .ele('coordinate', {x:arg.xWLBroadcastCoordinateX, y:arg.xWLBroadcastCoordinateY}).txt('W L').up()
          .ele('coordinate', {x:arg.xWLCBroadcastCoordinateX, y:arg.xWLCBroadcastCoordinateY}).txt('WLC').up()
          .ele('coordinate', {x:arg.xWCBroadcastCoordinateX, y:arg.xWCBroadcastCoordinateY}).txt('W C').up()
          .ele('coordinate', {x:arg.xWRCBroadcastCoordinateX, y:arg.xWRCBroadcastCoordinateY}).txt('WRC').up()
          .ele('coordinate', {x:arg.xWRBroadcastCoordinateX, y:arg.xWRBroadcastCoordinateY}).txt('W R').up()
          .ele('coordinate', {x:arg.xWRLBroadcastCoordinateX, y:arg.xWRLBroadcastCoordinateY}).txt('WRL').up()
          .ele('coordinate', {x:arg.x7LSBroadcastCoordinateX, y:arg.x7LSBroadcastCoordinateY}).txt('7LS').up()
          .ele('coordinate', {x:arg.x7LMBroadcastCoordinateX, y:arg.x7LMBroadcastCoordinateY}).txt('7LM').up()
          .ele('coordinate', {x:arg.x7LDBroadcastCoordinateX, y:arg.x7LDBroadcastCoordinateY}).txt('7LD').up()
          .ele('coordinate', {x:arg.x7SBroadcastCoordinateX, y:arg.x7SBroadcastCoordinateY}).txt('7S').up()
          .ele('coordinate', {x:arg.x7MBroadcastCoordinateX, y:arg.x7MBroadcastCoordinateY}).txt('7M').up()
          .ele('coordinate', {x:arg.x7DBroadcastCoordinateX, y:arg.x7DBroadcastCoordinateY}).txt('7D').up()
          .ele('coordinate', {x:arg.x78SBroadcastCoordinateX, y:arg.x78SBroadcastCoordinateY}).txt('78S').up()
          .ele('coordinate', {x:arg.x78MBroadcastCoordinateX, y:arg.x78MBroadcastCoordinateY}).txt('78M').up()
          .ele('coordinate', {x:arg.x78DBroadcastCoordinateX, y:arg.x78DBroadcastCoordinateY}).txt('78D').up()
          .ele('coordinate', {x:arg.x78XDBroadcastCoordinateX, y:arg.x78XDBroadcastCoordinateY}).txt('78XD').up()
          .ele('coordinate', {x:arg.x8LSBroadcastCoordinateX, y:arg.x8LSBroadcastCoordinateY}).txt('8LS').up()
          .ele('coordinate', {x:arg.x8LMBroadcastCoordinateX, y:arg.x8LMBroadcastCoordinateY}).txt('8LM').up()
          .ele('coordinate', {x:arg.x8LDBroadcastCoordinateX, y:arg.x8LDBroadcastCoordinateY}).txt('8LD').up()
          .ele('coordinate', {x:arg.x8LXDBroadcastCoordinateX, y:arg.x8LXDBroadcastCoordinateY}).txt('8LXD').up()
          .ele('coordinate', {x:arg.x8RSBroadcastCoordinateX, y:arg.x8RSBroadcastCoordinateY}).txt('8RS').up()
          .ele('coordinate', {x:arg.x8RMBroadcastCoordinateX, y:arg.x8RMBroadcastCoordinateY}).txt('8RM').up()
          .ele('coordinate', {x:arg.x8RDBroadcastCoordinateX, y:arg.x8RDBroadcastCoordinateY}).txt('8RD').up()
          .ele('coordinate', {x:arg.x8RXDBroadcastCoordinateX, y:arg.x8RXDBroadcastCoordinateY}).txt('8RXD').up()
          .ele('coordinate', {x:arg.x9LSBroadcastCoordinateX, y:arg.x9LSBroadcastCoordinateY}).txt('9LS').up()
          .ele('coordinate', {x:arg.x9LMBroadcastCoordinateX, y:arg.x9LMBroadcastCoordinateY}).txt('9LM').up()
          .ele('coordinate', {x:arg.x9LDBroadcastCoordinateX, y:arg.x9LDBroadcastCoordinateY}).txt('9LD').up()
          .ele('coordinate', {x:arg.x9SBroadcastCoordinateX, y:arg.x9SBroadcastCoordinateY}).txt('9S').up()
          .ele('coordinate', {x:arg.x9MBroadcastCoordinateX, y:arg.x9MBroadcastCoordinateY}).txt('9M').up()
          .ele('coordinate', {x:arg.x9DBroadcastCoordinateX, y:arg.x9DBroadcastCoordinateY}).txt('9D').up()
          .ele('coordinate', {x:arg.x89SBroadcastCoordinateX, y:arg.x89SBroadcastCoordinateY}).txt('89S').up()
          .ele('coordinate', {x:arg.x89MBroadcastCoordinateX, y:arg.x89MBroadcastCoordinateY}).txt('89M').up()
          .ele('coordinate', {x:arg.x89DBroadcastCoordinateX, y:arg.x89DBroadcastCoordinateY}).txt('89D').up()
          .ele('coordinate', {x:arg.x89DBroadcastCoordinateX, y:arg.x89DBroadcastCoordinateY}).txt('89XD').up()
          .ele('coordinate', {x:arg.x3BroadcastCoordinateX, y:arg.x3BroadcastCoordinateY}).txt('3').up()
          .ele('coordinate', {x:arg.x4BroadcastCoordinateX, y:arg.x4BroadcastCoordinateY}).txt('4').up()
          .ele('coordinate', {x:arg.x5BroadcastCoordinateX, y:arg.x5BroadcastCoordinateY}).txt('5').up()
          .ele('coordinate', {x:arg.x6BroadcastCoordinateX, y:arg.x6BroadcastCoordinateY}).txt('6').up()
          .ele('coordinate', {x:arg.x13BroadcastCoordinateX, y:arg.x13BroadcastCoordinateY}).txt('13').up()
          .ele('coordinate', {x:arg.x15BroadcastCoordinateX, y:arg.x15BroadcastCoordinateY}).txt('15').up()
          .ele('coordinate', {x:arg.x23BroadcastCoordinateX, y:arg.x23BroadcastCoordinateY}).txt('23').up()
          .ele('coordinate', {x:arg.x25BroadcastCoordinateX, y:arg.x25BroadcastCoordinateY}).txt('25').up()
          .ele('coordinate', {x:arg.x34BroadcastCoordinateX, y:arg.x34BroadcastCoordinateY}).txt('34').up()
          .ele('coordinate', {x:arg.x56BroadcastCoordinateX, y:arg.x56BroadcastCoordinateY}).txt('56').up()
          .ele('coordinate', {x:arg.x13SBroadcastCoordinateX, y:arg.x13SBroadcastCoordinateY}).txt('13S').up()
          .ele('coordinate', {x:arg.x15SBroadcastCoordinateX, y:arg.x15SBroadcastCoordinateY}).txt('15S').up()
          .ele('coordinate', {x:arg.x2LBroadcastCoordinateX, y:arg.x2LBroadcastCoordinateY}).txt('2L').up()
          .ele('coordinate', {x:arg.x2RBroadcastCoordinateX, y:arg.x2RBroadcastCoordinateY}).txt('2R').up()
          .ele('coordinate', {x:arg.x34DBroadcastCoordinateX, y:arg.x34DBroadcastCoordinateY}).txt('34D').up()
          .ele('coordinate', {x:arg.x34SBroadcastCoordinateX, y:arg.x34SBroadcastCoordinateY}).txt('34S').up()
          .ele('coordinate', {x:arg.x3DBroadcastCoordinateX, y:arg.x3DBroadcastCoordinateY}).txt('3D').up()
          .ele('coordinate', {x:arg.x3LBroadcastCoordinateX, y:arg.x3LBroadcastCoordinateY}).txt('3L').up()
          .ele('coordinate', {x:arg.x3SBroadcastCoordinateX, y:arg.x3SBroadcastCoordinateY}).txt('3S').up()
          .ele('coordinate', {x:arg.x4DBroadcastCoordinateX, y:arg.x4DBroadcastCoordinateY}).txt('4D').up()
          .ele('coordinate', {x:arg.x4MBroadcastCoordinateX, y:arg.x4MBroadcastCoordinateY}).txt('4M').up()
          .ele('coordinate', {x:arg.x4MDBroadcastCoordinateX, y:arg.x4MDBroadcastCoordinateY}).txt('4MD').up()
          .ele('coordinate', {x:arg.x4MSBroadcastCoordinateX, y:arg.x4MSBroadcastCoordinateY}).txt('4MS').up()
          .ele('coordinate', {x:arg.x4SBroadcastCoordinateX, y:arg.x4SBroadcastCoordinateY}).txt('4S').up()
          .ele('coordinate', {x:arg.x56DBroadcastCoordinateX, y:arg.x56DBroadcastCoordinateY}).txt('56D').up()
          .ele('coordinate', {x:arg.x56SBroadcastCoordinateX, y:arg.x56SBroadcastCoordinateY}).txt('56S').up()
          .ele('coordinate', {x:arg.x5DBroadcastCoordinateX, y:arg.x5DBroadcastCoordinateY}).txt('5D').up()
          .ele('coordinate', {x:arg.x5LBroadcastCoordinateX, y:arg.x5LBroadcastCoordinateY}).txt('5L').up()
          .ele('coordinate', {x:arg.x5SBroadcastCoordinateX, y:arg.x5SBroadcastCoordinateY}).txt('5S').up()
          .ele('coordinate', {x:arg.x6DBroadcastCoordinateX, y:arg.x6DBroadcastCoordinateY}).txt('6D').up()
          .ele('coordinate', {x:arg.x6MBroadcastCoordinateX, y:arg.x6MBroadcastCoordinateY}).txt('6M').up()
          .ele('coordinate', {x:arg.x6MDBroadcastCoordinateX, y:arg.x6MDBroadcastCoordinateY}).txt('6MD').up()
          .ele('coordinate', {x:arg.x6MSBroadcastCoordinateX, y:arg.x6MSBroadcastCoordinateY}).txt('6MS').up()
          .ele('coordinate', {x:arg.x6SBroadcastCoordinateX, y:arg.x6SBroadcastCoordinateY}).txt('6S').up()
          .ele('coordinate', {x:arg.xHPBroadcastCoordinateX, y:arg.xHPBroadcastCoordinateY}).txt('HP').up()
          .ele('coordinate', {x:arg.x2FBroadcastCoordinateX, y:arg.x2FBroadcastCoordinateY}).txt('2F').up()
          .ele('coordinate', {x:arg.x2LFBroadcastCoordinateX, y:arg.x2LFBroadcastCoordinateY}).txt('2LF').up()
          .ele('coordinate', {x:arg.x2RFBroadcastCoordinateX, y:arg.x2RFBroadcastCoordinateY}).txt('2RF').up()
          .ele('coordinate', {x:arg.x5DFBroadcastCoordinateX, y:arg.x5DFBroadcastCoordinateY}).txt('5DF').up()
          .ele('coordinate', {x:arg.x3DFBroadcastCoordinateX, y:arg.x3DFBroadcastCoordinateY}).txt('3DF').up()
          .ele('coordinate', {x:arg.x5FBroadcastCoordinateX, y:arg.x5FBroadcastCoordinateY}).txt('5F').up()
          .ele('coordinate', {x:arg.x3FBroadcastCoordinateX, y:arg.x3FBroadcastCoordinateY}).txt('3F').up()
          .ele('coordinate', {x:arg.x5SFBroadcastCoordinateX, y:arg.x5SFBroadcastCoordinateY}).txt('5SF').up()
          .ele('coordinate', {x:arg.x3SFBroadcastCoordinateX, y:arg.x3SFBroadcastCoordinateY}).txt('3SF').up()
          .ele('coordinate', {x:arg.x25FBroadcastCoordinateX, y:arg.x25FBroadcastCoordinateY}).txt('25F').up()
          .ele('coordinate', {x:arg.x23FBroadcastCoordinateX, y:arg.x23FBroadcastCoordinateY}).txt('23F').up()
          .ele('coordinate', {x:arg.x7LDBroadcastCoordinateX, y:arg.x7LDBroadcastCoordinateY}).txt('7LD').up()
          .ele('coordinate', {x:arg.x7LMBroadcastCoordinateX, y:arg.x7LMBroadcastCoordinateY}).txt('7LM').up()
          .ele('coordinate', {x:arg.x7LSBroadcastCoordinateX, y:arg.x7LSBroadcastCoordinateY}).txt('7LS').up()
          .ele('coordinate', {x:arg.x9LDBroadcastCoordinateX, y:arg.x9LDBroadcastCoordinateY}).txt('9LD').up()
          .ele('coordinate', {x:arg.x9LMBroadcastCoordinateX, y:arg.x9LMBroadcastCoordinateY}).txt('9LM').up()
          .ele('coordinate', {x:arg.x9LSBroadcastCoordinateX, y:arg.x9LSBroadcastCoordinateY}).txt('9LS').up()
        .up()
        .ele('NightBallCoordinates')
          .ele('coordinate', {x:arg.xWLLBroadcastCoordinateX, y:arg.xWLLBroadcastCoordinateY}).txt('WLL').up()
          .ele('coordinate', {x:arg.xWLBroadcastCoordinateX, y:arg.xWLBroadcastCoordinateY}).txt('W L').up()
          .ele('coordinate', {x:arg.xWLCBroadcastCoordinateX, y:arg.xWLCBroadcastCoordinateY}).txt('WLC').up()
          .ele('coordinate', {x:arg.xWCBroadcastCoordinateX, y:arg.xWCBroadcastCoordinateY}).txt('W C').up()
          .ele('coordinate', {x:arg.xWRCBroadcastCoordinateX, y:arg.xWRCBroadcastCoordinateY}).txt('WRC').up()
          .ele('coordinate', {x:arg.xWRBroadcastCoordinateX, y:arg.xWRBroadcastCoordinateY}).txt('W R').up()
          .ele('coordinate', {x:arg.xWRLBroadcastCoordinateX, y:arg.xWRLBroadcastCoordinateY}).txt('WRL').up()
          .ele('coordinate', {x:arg.x7LSBroadcastCoordinateX, y:arg.x7LSBroadcastCoordinateY}).txt('7LS').up()
          .ele('coordinate', {x:arg.x7LMBroadcastCoordinateX, y:arg.x7LMBroadcastCoordinateY}).txt('7LM').up()
          .ele('coordinate', {x:arg.x7LDBroadcastCoordinateX, y:arg.x7LDBroadcastCoordinateY}).txt('7LD').up()
          .ele('coordinate', {x:arg.x7SBroadcastCoordinateX, y:arg.x7SBroadcastCoordinateY}).txt('7S').up()
          .ele('coordinate', {x:arg.x7MBroadcastCoordinateX, y:arg.x7MBroadcastCoordinateY}).txt('7M').up()
          .ele('coordinate', {x:arg.x7DBroadcastCoordinateX, y:arg.x7DBroadcastCoordinateY}).txt('7D').up()
          .ele('coordinate', {x:arg.x78SBroadcastCoordinateX, y:arg.x78SBroadcastCoordinateY}).txt('78S').up()
          .ele('coordinate', {x:arg.x78MBroadcastCoordinateX, y:arg.x78MBroadcastCoordinateY}).txt('78M').up()
          .ele('coordinate', {x:arg.x78DBroadcastCoordinateX, y:arg.x78DBroadcastCoordinateY}).txt('78D').up()
          .ele('coordinate', {x:arg.x78XDBroadcastCoordinateX, y:arg.x78XDBroadcastCoordinateY}).txt('78XD').up()
          .ele('coordinate', {x:arg.x8LSBroadcastCoordinateX, y:arg.x8LSBroadcastCoordinateY}).txt('8LS').up()
          .ele('coordinate', {x:arg.x8LMBroadcastCoordinateX, y:arg.x8LMBroadcastCoordinateY}).txt('8LM').up()
          .ele('coordinate', {x:arg.x8LDBroadcastCoordinateX, y:arg.x8LDBroadcastCoordinateY}).txt('8LD').up()
          .ele('coordinate', {x:arg.x8LXDBroadcastCoordinateX, y:arg.x8LXDBroadcastCoordinateY}).txt('8LXD').up()
          .ele('coordinate', {x:arg.x8RSBroadcastCoordinateX, y:arg.x8RSBroadcastCoordinateY}).txt('8RS').up()
          .ele('coordinate', {x:arg.x8RMBroadcastCoordinateX, y:arg.x8RMBroadcastCoordinateY}).txt('8RM').up()
          .ele('coordinate', {x:arg.x8RDBroadcastCoordinateX, y:arg.x8RDBroadcastCoordinateY}).txt('8RD').up()
          .ele('coordinate', {x:arg.x8RXDBroadcastCoordinateX, y:arg.x8RXDBroadcastCoordinateY}).txt('8RXD').up()
          .ele('coordinate', {x:arg.x9LSBroadcastCoordinateX, y:arg.x9LSBroadcastCoordinateY}).txt('9LS').up()
          .ele('coordinate', {x:arg.x9LMBroadcastCoordinateX, y:arg.x9LMBroadcastCoordinateY}).txt('9LM').up()
          .ele('coordinate', {x:arg.x9LDBroadcastCoordinateX, y:arg.x9LDBroadcastCoordinateY}).txt('9LD').up()
          .ele('coordinate', {x:arg.x9SBroadcastCoordinateX, y:arg.x9SBroadcastCoordinateY}).txt('9S').up()
          .ele('coordinate', {x:arg.x9MBroadcastCoordinateX, y:arg.x9MBroadcastCoordinateY}).txt('9M').up()
          .ele('coordinate', {x:arg.x9DBroadcastCoordinateX, y:arg.x9DBroadcastCoordinateY}).txt('9D').up()
          .ele('coordinate', {x:arg.x89SBroadcastCoordinateX, y:arg.x89SBroadcastCoordinateY}).txt('89S').up()
          .ele('coordinate', {x:arg.x89MBroadcastCoordinateX, y:arg.x89MBroadcastCoordinateY}).txt('89M').up()
          .ele('coordinate', {x:arg.x89DBroadcastCoordinateX, y:arg.x89DBroadcastCoordinateY}).txt('89D').up()
          .ele('coordinate', {x:arg.x89DBroadcastCoordinateX, y:arg.x89DBroadcastCoordinateY}).txt('89XD').up()
          .ele('coordinate', {x:arg.x3BroadcastCoordinateX, y:arg.x3BroadcastCoordinateY}).txt('3').up()
          .ele('coordinate', {x:arg.x4BroadcastCoordinateX, y:arg.x4BroadcastCoordinateY}).txt('4').up()
          .ele('coordinate', {x:arg.x5BroadcastCoordinateX, y:arg.x5BroadcastCoordinateY}).txt('5').up()
          .ele('coordinate', {x:arg.x6BroadcastCoordinateX, y:arg.x6BroadcastCoordinateY}).txt('6').up()
          .ele('coordinate', {x:arg.x13BroadcastCoordinateX, y:arg.x13BroadcastCoordinateY}).txt('13').up()
          .ele('coordinate', {x:arg.x15BroadcastCoordinateX, y:arg.x15BroadcastCoordinateY}).txt('15').up()
          .ele('coordinate', {x:arg.x23BroadcastCoordinateX, y:arg.x23BroadcastCoordinateY}).txt('23').up()
          .ele('coordinate', {x:arg.x25BroadcastCoordinateX, y:arg.x25BroadcastCoordinateY}).txt('25').up()
          .ele('coordinate', {x:arg.x34BroadcastCoordinateX, y:arg.x34BroadcastCoordinateY}).txt('34').up()
          .ele('coordinate', {x:arg.x56BroadcastCoordinateX, y:arg.x56BroadcastCoordinateY}).txt('56').up()
          .ele('coordinate', {x:arg.x13SBroadcastCoordinateX, y:arg.x13SBroadcastCoordinateY}).txt('13S').up()
          .ele('coordinate', {x:arg.x15SBroadcastCoordinateX, y:arg.x15SBroadcastCoordinateY}).txt('15S').up()
          .ele('coordinate', {x:arg.x2LBroadcastCoordinateX, y:arg.x2LBroadcastCoordinateY}).txt('2L').up()
          .ele('coordinate', {x:arg.x2RBroadcastCoordinateX, y:arg.x2RBroadcastCoordinateY}).txt('2R').up()
          .ele('coordinate', {x:arg.x34DBroadcastCoordinateX, y:arg.x34DBroadcastCoordinateY}).txt('34D').up()
          .ele('coordinate', {x:arg.x34SBroadcastCoordinateX, y:arg.x34SBroadcastCoordinateY}).txt('34S').up()
          .ele('coordinate', {x:arg.x3DBroadcastCoordinateX, y:arg.x3DBroadcastCoordinateY}).txt('3D').up()
          .ele('coordinate', {x:arg.x3LBroadcastCoordinateX, y:arg.x3LBroadcastCoordinateY}).txt('3L').up()
          .ele('coordinate', {x:arg.x3SBroadcastCoordinateX, y:arg.x3SBroadcastCoordinateY}).txt('3S').up()
          .ele('coordinate', {x:arg.x4DBroadcastCoordinateX, y:arg.x4DBroadcastCoordinateY}).txt('4D').up()
          .ele('coordinate', {x:arg.x4MBroadcastCoordinateX, y:arg.x4MBroadcastCoordinateY}).txt('4M').up()
          .ele('coordinate', {x:arg.x4MDBroadcastCoordinateX, y:arg.x4MDBroadcastCoordinateY}).txt('4MD').up()
          .ele('coordinate', {x:arg.x4MSBroadcastCoordinateX, y:arg.x4MSBroadcastCoordinateY}).txt('4MS').up()
          .ele('coordinate', {x:arg.x4SBroadcastCoordinateX, y:arg.x4SBroadcastCoordinateY}).txt('4S').up()
          .ele('coordinate', {x:arg.x56DBroadcastCoordinateX, y:arg.x56DBroadcastCoordinateY}).txt('56D').up()
          .ele('coordinate', {x:arg.x56SBroadcastCoordinateX, y:arg.x56SBroadcastCoordinateY}).txt('56S').up()
          .ele('coordinate', {x:arg.x5DBroadcastCoordinateX, y:arg.x5DBroadcastCoordinateY}).txt('5D').up()
          .ele('coordinate', {x:arg.x5LBroadcastCoordinateX, y:arg.x5LBroadcastCoordinateY}).txt('5L').up()
          .ele('coordinate', {x:arg.x5SBroadcastCoordinateX, y:arg.x5SBroadcastCoordinateY}).txt('5S').up()
          .ele('coordinate', {x:arg.x6DBroadcastCoordinateX, y:arg.x6DBroadcastCoordinateY}).txt('6D').up()
          .ele('coordinate', {x:arg.x6MBroadcastCoordinateX, y:arg.x6MBroadcastCoordinateY}).txt('6M').up()
          .ele('coordinate', {x:arg.x6MDBroadcastCoordinateX, y:arg.x6MDBroadcastCoordinateY}).txt('6MD').up()
          .ele('coordinate', {x:arg.x6MSBroadcastCoordinateX, y:arg.x6MSBroadcastCoordinateY}).txt('6MS').up()
          .ele('coordinate', {x:arg.x6SBroadcastCoordinateX, y:arg.x6SBroadcastCoordinateY}).txt('6S').up()
          .ele('coordinate', {x:arg.xHPBroadcastCoordinateX, y:arg.xHPBroadcastCoordinateY}).txt('HP').up()
          .ele('coordinate', {x:arg.x2FBroadcastCoordinateX, y:arg.x2FBroadcastCoordinateY}).txt('2F').up()
          .ele('coordinate', {x:arg.x2LFBroadcastCoordinateX, y:arg.x2LFBroadcastCoordinateY}).txt('2LF').up()
          .ele('coordinate', {x:arg.x2RFBroadcastCoordinateX, y:arg.x2RFBroadcastCoordinateY}).txt('2RF').up()
          .ele('coordinate', {x:arg.x5DFBroadcastCoordinateX, y:arg.x5DFBroadcastCoordinateY}).txt('5DF').up()
          .ele('coordinate', {x:arg.x3DFBroadcastCoordinateX, y:arg.x3DFBroadcastCoordinateY}).txt('3DF').up()
          .ele('coordinate', {x:arg.x5FBroadcastCoordinateX, y:arg.x5FBroadcastCoordinateY}).txt('5F').up()
          .ele('coordinate', {x:arg.x3FBroadcastCoordinateX, y:arg.x3FBroadcastCoordinateY}).txt('3F').up()
          .ele('coordinate', {x:arg.x5SFBroadcastCoordinateX, y:arg.x5SFBroadcastCoordinateY}).txt('5SF').up()
          .ele('coordinate', {x:arg.x3SFBroadcastCoordinateX, y:arg.x3SFBroadcastCoordinateY}).txt('3SF').up()
          .ele('coordinate', {x:arg.x25FBroadcastCoordinateX, y:arg.x25FBroadcastCoordinateY}).txt('25F').up()
          .ele('coordinate', {x:arg.x23FBroadcastCoordinateX, y:arg.x23FBroadcastCoordinateY}).txt('23F').up()
          .ele('coordinate', {x:arg.x7LDBroadcastCoordinateX, y:arg.x7LDBroadcastCoordinateY}).txt('7LD').up()
          .ele('coordinate', {x:arg.x7LMBroadcastCoordinateX, y:arg.x7LMBroadcastCoordinateY}).txt('7LM').up()
          .ele('coordinate', {x:arg.x7LSBroadcastCoordinateX, y:arg.x7LSBroadcastCoordinateY}).txt('7LS').up()
          .ele('coordinate', {x:arg.x9LDBroadcastCoordinateX, y:arg.x9LDBroadcastCoordinateY}).txt('9LD').up()
          .ele('coordinate', {x:arg.x9LMBroadcastCoordinateX, y:arg.x9LMBroadcastCoordinateY}).txt('9LM').up()
          .ele('coordinate', {x:arg.x9LSBroadcastCoordinateX, y:arg.x9LSBroadcastCoordinateY}).txt('9LS').up()
        .up()
        .ele('DiagramBallCoordinates')
          .ele('coordinate', {x:arg.xWLLWebcastCoordinateX, y:arg.xWLLWebcastCoordinateY}).txt('WLL').up()
          .ele('coordinate', {x:arg.xWLWebcastCoordinateX, y:arg.xWLWebcastCoordinateY}).txt('W L').up()
          .ele('coordinate', {x:arg.xWLCWebcastCoordinateX, y:arg.xWLCWebcastCoordinateY}).txt('WLC').up()
          .ele('coordinate', {x:arg.xWCWebcastCoordinateX, y:arg.xWCWebcastCoordinateY}).txt('W C').up()
          .ele('coordinate', {x:arg.xWRCWebcastCoordinateX, y:arg.xWRCWebcastCoordinateY}).txt('WRC').up()
          .ele('coordinate', {x:arg.xWRWebcastCoordinateX, y:arg.xWRWebcastCoordinateY}).txt('W R').up()
          .ele('coordinate', {x:arg.xWRLWebcastCoordinateX, y:arg.xWRLWebcastCoordinateY}).txt('WRL').up()
          .ele('coordinate', {x:arg.x7LSWebcastCoordinateX, y:arg.x7LSWebcastCoordinateY}).txt('7LS').up()
          .ele('coordinate', {x:arg.x7LMWebcastCoordinateX, y:arg.x7LMWebcastCoordinateY}).txt('7LM').up()
          .ele('coordinate', {x:arg.x7LDWebcastCoordinateX, y:arg.x7LDWebcastCoordinateY}).txt('7LD').up()
          .ele('coordinate', {x:arg.x7SWebcastCoordinateX, y:arg.x7SWebcastCoordinateY}).txt('7S').up()
          .ele('coordinate', {x:arg.x7MWebcastCoordinateX, y:arg.x7MWebcastCoordinateY}).txt('7M').up()
          .ele('coordinate', {x:arg.x7DWebcastCoordinateX, y:arg.x7DWebcastCoordinateY}).txt('7D').up()
          .ele('coordinate', {x:arg.x78SWebcastCoordinateX, y:arg.x78SWebcastCoordinateY}).txt('78S').up()
          .ele('coordinate', {x:arg.x78MWebcastCoordinateX, y:arg.x78MWebcastCoordinateY}).txt('78M').up()
          .ele('coordinate', {x:arg.x78DWebcastCoordinateX, y:arg.x78DWebcastCoordinateY}).txt('78D').up()
          .ele('coordinate', {x:arg.x78XDWebcastCoordinateX, y:arg.x78XDWebcastCoordinateY}).txt('78XD').up()
          .ele('coordinate', {x:arg.x8LSWebcastCoordinateX, y:arg.x8LSWebcastCoordinateY}).txt('8LS').up()
          .ele('coordinate', {x:arg.x8LMWebcastCoordinateX, y:arg.x8LMWebcastCoordinateY}).txt('8LM').up()
          .ele('coordinate', {x:arg.x8LDWebcastCoordinateX, y:arg.x8LDWebcastCoordinateY}).txt('8LD').up()
          .ele('coordinate', {x:arg.x8LXDWebcastCoordinateX, y:arg.x8LXDWebcastCoordinateY}).txt('8LXD').up()
          .ele('coordinate', {x:arg.x8RSWebcastCoordinateX, y:arg.x8RSWebcastCoordinateY}).txt('8RS').up()
          .ele('coordinate', {x:arg.x8RMWebcastCoordinateX, y:arg.x8RMWebcastCoordinateY}).txt('8RM').up()
          .ele('coordinate', {x:arg.x8RDWebcastCoordinateX, y:arg.x8RDWebcastCoordinateY}).txt('8RD').up()
          .ele('coordinate', {x:arg.x8RXDWebcastCoordinateX, y:arg.x8RXDWebcastCoordinateY}).txt('8RXD').up()
          .ele('coordinate', {x:arg.x9LSWebcastCoordinateX, y:arg.x9LSWebcastCoordinateY}).txt('9LS').up()
          .ele('coordinate', {x:arg.x9LMWebcastCoordinateX, y:arg.x9LMWebcastCoordinateY}).txt('9LM').up()
          .ele('coordinate', {x:arg.x9LDWebcastCoordinateX, y:arg.x9LDWebcastCoordinateY}).txt('9LD').up()
          .ele('coordinate', {x:arg.x9SWebcastCoordinateX, y:arg.x9SWebcastCoordinateY}).txt('9S').up()
          .ele('coordinate', {x:arg.x9MWebcastCoordinateX, y:arg.x9MWebcastCoordinateY}).txt('9M').up()
          .ele('coordinate', {x:arg.x9DWebcastCoordinateX, y:arg.x9DWebcastCoordinateY}).txt('9D').up()
          .ele('coordinate', {x:arg.x89SWebcastCoordinateX, y:arg.x89SWebcastCoordinateY}).txt('89S').up()
          .ele('coordinate', {x:arg.x89MWebcastCoordinateX, y:arg.x89MWebcastCoordinateY}).txt('89M').up()
          .ele('coordinate', {x:arg.x89DWebcastCoordinateX, y:arg.x89DWebcastCoordinateY}).txt('89D').up()
          .ele('coordinate', {x:arg.x89DWebcastCoordinateX, y:arg.x89DWebcastCoordinateY}).txt('89XD').up()
          .ele('coordinate', {x:arg.x3WebcastCoordinateX, y:arg.x3WebcastCoordinateY}).txt('3').up()
          .ele('coordinate', {x:arg.x4WebcastCoordinateX, y:arg.x4WebcastCoordinateY}).txt('4').up()
          .ele('coordinate', {x:arg.x5WebcastCoordinateX, y:arg.x5WebcastCoordinateY}).txt('5').up()
          .ele('coordinate', {x:arg.x6WebcastCoordinateX, y:arg.x6WebcastCoordinateY}).txt('6').up()
          .ele('coordinate', {x:arg.x13WebcastCoordinateX, y:arg.x13WebcastCoordinateY}).txt('13').up()
          .ele('coordinate', {x:arg.x15WebcastCoordinateX, y:arg.x15WebcastCoordinateY}).txt('15').up()
          .ele('coordinate', {x:arg.x23WebcastCoordinateX, y:arg.x23WebcastCoordinateY}).txt('23').up()
          .ele('coordinate', {x:arg.x25WebcastCoordinateX, y:arg.x25WebcastCoordinateY}).txt('25').up()
          .ele('coordinate', {x:arg.x34WebcastCoordinateX, y:arg.x34WebcastCoordinateY}).txt('34').up()
          .ele('coordinate', {x:arg.x56WebcastCoordinateX, y:arg.x56WebcastCoordinateY}).txt('56').up()
          .ele('coordinate', {x:arg.x13SWebcastCoordinateX, y:arg.x13SWebcastCoordinateY}).txt('13S').up()
          .ele('coordinate', {x:arg.x15SWebcastCoordinateX, y:arg.x15SWebcastCoordinateY}).txt('15S').up()
          .ele('coordinate', {x:arg.x2LWebcastCoordinateX, y:arg.x2LWebcastCoordinateY}).txt('2L').up()
          .ele('coordinate', {x:arg.x2RWebcastCoordinateX, y:arg.x2RWebcastCoordinateY}).txt('2R').up()
          .ele('coordinate', {x:arg.x34DWebcastCoordinateX, y:arg.x34DWebcastCoordinateY}).txt('34D').up()
          .ele('coordinate', {x:arg.x34SWebcastCoordinateX, y:arg.x34SWebcastCoordinateY}).txt('34S').up()
          .ele('coordinate', {x:arg.x3DWebcastCoordinateX, y:arg.x3DWebcastCoordinateY}).txt('3D').up()
          .ele('coordinate', {x:arg.x3LWebcastCoordinateX, y:arg.x3LWebcastCoordinateY}).txt('3L').up()
          .ele('coordinate', {x:arg.x3SWebcastCoordinateX, y:arg.x3SWebcastCoordinateY}).txt('3S').up()
          .ele('coordinate', {x:arg.x4DWebcastCoordinateX, y:arg.x4DWebcastCoordinateY}).txt('4D').up()
          .ele('coordinate', {x:arg.x4MWebcastCoordinateX, y:arg.x4MWebcastCoordinateY}).txt('4M').up()
          .ele('coordinate', {x:arg.x4MDWebcastCoordinateX, y:arg.x4MDWebcastCoordinateY}).txt('4MD').up()
          .ele('coordinate', {x:arg.x4MSWebcastCoordinateX, y:arg.x4MSWebcastCoordinateY}).txt('4MS').up()
          .ele('coordinate', {x:arg.x4SWebcastCoordinateX, y:arg.x4SWebcastCoordinateY}).txt('4S').up()
          .ele('coordinate', {x:arg.x56DWebcastCoordinateX, y:arg.x56DWebcastCoordinateY}).txt('56D').up()
          .ele('coordinate', {x:arg.x56SWebcastCoordinateX, y:arg.x56SWebcastCoordinateY}).txt('56S').up()
          .ele('coordinate', {x:arg.x5DWebcastCoordinateX, y:arg.x5DWebcastCoordinateY}).txt('5D').up()
          .ele('coordinate', {x:arg.x5LWebcastCoordinateX, y:arg.x5LWebcastCoordinateY}).txt('5L').up()
          .ele('coordinate', {x:arg.x5SWebcastCoordinateX, y:arg.x5SWebcastCoordinateY}).txt('5S').up()
          .ele('coordinate', {x:arg.x6DWebcastCoordinateX, y:arg.x6DWebcastCoordinateY}).txt('6D').up()
          .ele('coordinate', {x:arg.x6MWebcastCoordinateX, y:arg.x6MWebcastCoordinateY}).txt('6M').up()
          .ele('coordinate', {x:arg.x6MDWebcastCoordinateX, y:arg.x6MDWebcastCoordinateY}).txt('6MD').up()
          .ele('coordinate', {x:arg.x6MSWebcastCoordinateX, y:arg.x6MSWebcastCoordinateY}).txt('6MS').up()
          .ele('coordinate', {x:arg.x6SWebcastCoordinateX, y:arg.x6SWebcastCoordinateY}).txt('6S').up()
          .ele('coordinate', {x:arg.xHPWebcastCoordinateX, y:arg.xHPWebcastCoordinateY}).txt('HP').up()
          .ele('coordinate', {x:arg.x2FWebcastCoordinateX, y:arg.x2FWebcastCoordinateY}).txt('2F').up()
          .ele('coordinate', {x:arg.x2LFWebcastCoordinateX, y:arg.x2LFWebcastCoordinateY}).txt('2LF').up()
          .ele('coordinate', {x:arg.x2RFWebcastCoordinateX, y:arg.x2RFWebcastCoordinateY}).txt('2RF').up()
          .ele('coordinate', {x:arg.x5DFWebcastCoordinateX, y:arg.x5DFWebcastCoordinateY}).txt('5DF').up()
          .ele('coordinate', {x:arg.x3DFWebcastCoordinateX, y:arg.x3DFWebcastCoordinateY}).txt('3DF').up()
          .ele('coordinate', {x:arg.x5FWebcastCoordinateX, y:arg.x5FWebcastCoordinateY}).txt('5F').up()
          .ele('coordinate', {x:arg.x3FWebcastCoordinateX, y:arg.x3FWebcastCoordinateY}).txt('3F').up()
          .ele('coordinate', {x:arg.x5SFWebcastCoordinateX, y:arg.x5SFWebcastCoordinateY}).txt('5SF').up()
          .ele('coordinate', {x:arg.x3SFWebcastCoordinateX, y:arg.x3SFWebcastCoordinateY}).txt('3SF').up()
          .ele('coordinate', {x:arg.x25FWebcastCoordinateX, y:arg.x25FWebcastCoordinateY}).txt('25F').up()
          .ele('coordinate', {x:arg.x23FWebcastCoordinateX, y:arg.x23FWebcastCoordinateY}).txt('23F').up()
          .ele('coordinate', {x:arg.x7LDWebcastCoordinateX, y:arg.x7LDWebcastCoordinateY}).txt('7LD').up()
          .ele('coordinate', {x:arg.x7LMWebcastCoordinateX, y:arg.x7LMWebcastCoordinateY}).txt('7LM').up()
          .ele('coordinate', {x:arg.x7LSWebcastCoordinateX, y:arg.x7LSWebcastCoordinateY}).txt('7LS').up()
          .ele('coordinate', {x:arg.x9LDWebcastCoordinateX, y:arg.x9LDWebcastCoordinateY}).txt('9LD').up()
          .ele('coordinate', {x:arg.x9LMWebcastCoordinateX, y:arg.x9LMWebcastCoordinateY}).txt('9LM').up()
          .ele('coordinate', {x:arg.x9LSWebcastCoordinateX, y:arg.x9LSWebcastCoordinateY}).txt('9LS').up()
        .up()
    .up();

    const xml = root.end({ prettyPrint: true });

    xmlBuffer = Buffer.from(xml, 'utf-8');

    const output = fs.createWriteStream(tempDir + '/'+parkName+'.zip');

    output.on('close', function() {
      var data = fs.readFileSync(tempDir + '/'+parkName+'.zip');
      var saveOptions = {
        defaultPath: increment(store.get("downloadPath", app.getPath('downloads')) + '/' + parkName+'.zip',{fs: true})
      }
      dialog.showSaveDialog(null, saveOptions).then((result) => { 
        if (!result.canceled) {
          store.set("downloadPath", path.dirname(result.filePath))
          fs.writeFile(result.filePath, data, function(err) {
            if (err) {
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
            };
          })
        } else {
          fs.unlink(tempDir + '/'+parkName+'.zip', (err) => {
            if (err) {
              console.error(err)
              return
            }
          })
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

    prepareImages() 

    async function prepareImages() {
      let field = await Jimp.read(buffer)

      if (parkType == 'Dome') {
        let dome = await Jimp.read(__dirname + '/images/dome.png')
        await dome.composite(field, 100, 0, {mode:Jimp.BLEND_SOURCE_OVER})
        let domeBuffer = await dome.getBufferAsync(Jimp.MIME_PNG)
        archive.append(domeBuffer, {name: parkName+'_dome.png'})
      } else {
        let day = await Jimp.read(__dirname + '/images/day_bg.png')
        let night = await Jimp.read(__dirname + '/images/night_bg.png') 
        await day.composite(field, 100, 0, {mode:Jimp.BLEND_SOURCE_OVER})
        await night.composite(field, 100, 0, {mode:Jimp.BLEND_SOURCE_OVER})
        let dayBuffer = await day.getBufferAsync(Jimp.MIME_PNG)
        let nightBuffer = await night.getBufferAsync(Jimp.MIME_PNG)
        archive.append(dayBuffer, { name: parkName+'_day.png' });
        archive.append(nightBuffer, { name: parkName+'_night.png' });
      }
      archive.append(buffer, { name: parkName+"_webcast.png" });
      archive.append(xmlBuffer, { name: parkName+".xml" });
      archive.append(txtBuffer, { name: 'readme.txt' });
      archive.finalize();
    }
})

const createWindow = () => {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 875,
    icon: (__dirname + '/images/ballpark.png'),
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false 
  }
  })

  // and load the index.html of the app.
  mainWindow.loadURL(`file://${__dirname}/index.html`);

  mainWindow.webContents.on('new-window', function(e, url) {
    e.preventDefault();
    require('electron').shell.openExternal(url);
  });

  // Open the DevTools.
    mainWindow.maximize()
   mainWindow.webContents.openDevTools()
}

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