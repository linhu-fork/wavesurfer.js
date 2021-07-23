'use strict';

var wavesurfer;

// Init & load
document.addEventListener('DOMContentLoaded', function() {
    // Create an instance
    var options = {
        container: '#waveImage',
        waveColor: 'violet',
        progressColor: 'purple',
        loaderColor: 'purple',
        cursorColor: 'navy',
        plugins: [
            WaveSurfer.regions.create({
                dragSelection: {
                    slop: 5
                }
            }),
            WaveSurfer.spectrogramImage.create({
                container: '#wave-spectrogram',
                name: 'zrh',
                imageUrl: 'http://localhost:3002/images/1.png',
                height: 129
            })
        ]
    };

    if (location.search.match('scroll')) {
        options.minPxPerSec = 100;
        options.scrollParent = true;
    }

    if (location.search.match('normalize')) {
        options.normalize = true;
    }

    wavesurfer = WaveSurfer.create(options);

    wavesurfer.load('../media/demo.wav');
});
