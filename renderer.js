const { app, shell, ipcRenderer } = require('electron')

ipcRenderer.on('load-ballpark', (event, data) => {
    $("#loadPark").trigger("click")
});

ipcRenderer.on('save-ballpark', (event, data) => {
    $("#downloadParkOriginal").trigger("click")
});

ipcRenderer.on('random-ballpark', (event, data) => {
    $("#randomPark").trigger("click")
});

ipcRenderer.on('random-name', (event, data) => {
    $("#randomName").trigger("click")
});

ipcRenderer.on('flip-ballpark', (event, data) => {
    $("#flipPark").trigger("click")
});

ipcRenderer.on('get-template', (event, data) => {
    $("#templateDownload").trigger("click")
})

ipcRenderer.on('about', (event, data) => {
    $("#about").trigger("click")
});

ipcRenderer.on('add-pattern', (event, data) => {
    $("#addPattern").trigger("click")
});

ipcRenderer.on('add-image', (event, data) => {
    $("#addImage").trigger("click")
});

ipcRenderer.on("show-players", (event, data) => {
  console.log("show players");
  $(".addMowPattern").prop("disabled", true);
  $("#addImage").prop("disabled", true);
  $(".factorHeader, .factorFooter").css("display", "none");
  $("#coordinateContainerDiv").removeClass("noEvent");
  $("#coordinateContainerDiv").css("display", "inline-block");
  $(".xy").each(function (e) {
    if ($(this).hasClass($("#playerCoordSelect").val())) {
      $(this).css("display", "block");
    } else {
      $(this).css("display", "none");
    }
  });
  $("#playerCoordinatesFieldset").css("display", "block");
  $(".weatherFieldset").css("display", "none");
  switch ($("#playerCoordSelect").val()) {
    case "broadcastPlayers":
      coordinateCanvas.setWidth("800");
      break;
    case "broadcastBall":
      coordinateCanvas.setWidth("800");
      break;
    case "webcastPlayers":
      coordinateCanvas.setWidth("600");
      break;
    case "webcastBall":
      coordinateCanvas.setWidth("600");
      break;
    default:
      coordinateCanvas.setWidth("800");
  }
  if ($("#playerCoordSelect").val().indexOf("broadcast") > -1) {
    if ($("#ballparkType").val() == "3") {
      $("#attribution").html("Image by Wikipedia user Dlz28");
      $("#bgImageDiv")
        .removeClass("webcast")
        .removeClass("broadcast")
        .addClass("broadcast_dome");
    } else {
      $("#attribution").html(
        '"Rule of Thirds" by Stuart Seeger, used under CC BY / Cropped from original'
      );
      $("#bgImageDiv")
        .removeClass("webcast")
        .removeClass("broadcast_dome")
        .addClass("broadcast");
    }
  } else {
    $("#attribution").html("");
    $("#bgImageDiv")
      .removeClass("broadcast")
      .removeClass("broadcast_dome")
      .addClass("webcast");
  }
  $("#bgImageContainerDiv").css("display", "inline-block");
  coordinateCanvas.calcOffset();
  populateCanvas3($("#playerCoordSelect").val());
});

ipcRenderer.on("show-weather", (event, data) => {
  console.log("show weather");
  $(".addMowPattern").prop("disabled", false);
  $("#addImage").prop("disabled", false);
  $(".factorHeader, .factorFooter").css("display", "inline-block");
  switch ($("#playerCoordSelect").val()) {
    case "broadcastPlayers":
      broadcastPlayers = JSON.stringify(
        coordinateCanvas.toJSON([
          "id",
          "xID",
          "yID",
          "hasBorders",
          "borderColor",
          "hasControls",
        ])
      );
      break;
    case "broadcastBall":
      broadcastBall = JSON.stringify(
        coordinateCanvas.toJSON([
          "id",
          "xID",
          "yID",
          "hasBorders",
          "borderColor",
          "hasControls",
        ])
      );
      break;
    case "webcastPlayers":
      webcastPlayers = JSON.stringify(
        coordinateCanvas.toJSON([
          "id",
          "xID",
          "yID",
          "hasBorders",
          "borderColor",
          "hasControls",
        ])
      );
      break;
    case "webcastBall":
      webcastBall = JSON.stringify(
        coordinateCanvas.toJSON([
          "id",
          "xID",
          "yID",
          "hasBorders",
          "borderColor",
          "hasControls",
        ])
      );
      break;
  }
  $("#bgImageContainerDiv").css("display", "none");
  $("#coordinateContainerDiv").addClass("noEvent");
  $("#coordinateContainerDiv").css("display", "none");
  $(".xy").each(function (e) {
    if ($(this).hasClass($("#playerCoordSelect").val())) {
      $(this).css("display", "block");
    } else {
      $(this).css("display", "none");
    }
  });
  $("#playerCoordinatesFieldset").css("display", "none");
  $(".weatherFieldset").css("display", "block");
  logoCanvas.calcOffset();
});