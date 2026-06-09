import { Start } from './scenes/Start.js'; 

const config = {
    type: Phaser.AUTO,
    // 1. On définit une résolution de base "virtuelle" (un ratio 16:9 standard)
    width: 1920,
    height: 1080,
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: 0 },
            debug: false
        }
    },
    // 2. Configuration du mode Plein Écran (Scale Manager)
    scale: {
        mode: Phaser.Scale.FIT,           // Adapte le jeu pour qu'il entre dans l'écran
        autoCenter: Phaser.Scale.CENTER_BOTH, // Centre le jeu horizontalement et verticalement
        width: '100%',
        height: '100%'
    },
    scene: [Start] 
};

const game = new Phaser.Game(config);
            