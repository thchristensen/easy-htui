const { app, nativeImage } = require('electron');
app.whenReady().then(() => {
    const img = nativeImage.createFromPath('assets/icons/icon.ico');
    console.log('Is empty?', img.isEmpty());
    app.quit();
});
