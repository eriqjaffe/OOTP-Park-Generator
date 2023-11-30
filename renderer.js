const { app, shell, ipcRenderer } = require('electron')

ipcRenderer.on('load-ballpark', (event, data) => {
    $("#load").trigger("click")
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