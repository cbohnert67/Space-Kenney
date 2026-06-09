export class Start extends Phaser.Scene {

    constructor() {
        super('Start');
    }

    preload() {
        // Chargement des images et spritesheets depuis tes dossiers locaux
        this.load.image('background', 'assets/background/darkPurple.png');
        this.load.spritesheet('ship', 'assets/PNG/playerShip1_red.png', { frameWidth: 99, frameHeight: 75 });
        this.load.spritesheet('laser', 'assets/PNG/Lasers/laserGreen02.png', { frameWidth: 13, frameHeight: 57 });
        
        this.load.spritesheet('asteroide_sheet', 'assets/animated_asteroid.png', { 
            frameWidth: 70,  
            frameHeight: 70,  
            margin: 0,
            spacing: 0
        });

        this.load.spritesheet('explosion_sheet', 'assets/Explosion.png', {
            frameWidth: 96,
            frameHeight: 96
        });
    }

    create() {
        // 1. CONFIGURATION DES ASSETS (Horizontal vs Vertical)
        // Si tes propres fichiers locaux de vaisseau/lasers sont dessinés horizontalement (pointant vers la droite),
        // laisse cette variable à "false". Phaser les pivotera automatiquement de -90° vers le haut.
        // Si tes nouveaux assets pointent déjà nativement vers le haut, passe-la à "true".
        this.assetsSontVerticaux = true;

        // GENERATEUR AUTOMATIQUE DE TEXTURES DE SECOURS (Anti-Crash)
        this.genererTexturesDeSecours();

        // 2. INITIALISATION DES VARIABLES DU GAMEPLAY
        this.score = 0;
        this.vies = 3;
        this.estInvulnerable = false;
        this.partieTerminee = false;
        this.prochainTir = 0;

        // Statuts des Power-ups
        this.hasShield = false;
        this.shieldDuration = 0;
        this.aTripleTir = false;
        this.tripleShotDuration = 0;

        // Parallaxe de fond étoilé (Défilement vertical)
        this.background = this.add.tileSprite(640, 360, 1280, 720, 'background');

        // Création du vaisseau joueur (Centré en bas de l'écran)
        this.ship = this.physics.add.sprite(640, 600, 'ship');
        this.ship.setCollideWorldBounds(true);
        
        // Ajustement dynamique de la hitbox et de l'orientation du vaisseau
        if (!this.assetsSontVerticaux) {
            this.ship.setAngle(-90); // Pivote le sprite horizontal vers le haut
            this.ship.body.setSize(50, 120, true); // Hitbox étroite et haute
        } else {
            this.ship.body.setSize(120, 50, true); // Hitbox normale si l'asset est déjà vertical
        }

        // Graphisme pour dessiner la bulle de bouclier énergétique
        this.shieldGraphics = this.add.graphics();

        // Assignation des touches de contrôle
        this.cursors = this.input.keyboard.createCursorKeys();
        this.touchesZQSD = this.input.keyboard.addKeys({
            up: Phaser.Input.Keyboard.KeyCodes.Z,
            down: Phaser.Input.Keyboard.KeyCodes.S,
            left: Phaser.Input.Keyboard.KeyCodes.Q,
            right: Phaser.Input.Keyboard.KeyCodes.D
        });
        this.spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

        // Groupes d'objets physiques
        this.lasers = this.physics.add.group();
        this.asteroides = this.physics.add.group();
        this.powerups = this.physics.add.group();

        // --- CRÉATION ET CONFIGURATION DES ANIMATIONS ---
        
        // Vol du vaisseau
        this.ship.anims.create({
            key: 'fly',
            frames: this.anims.generateFrameNumbers('ship', { start: 0, end: 2 }),
            frameRate: 15,
            repeat: -1
        });
        this.ship.play('fly');

        // Rotation horaire des astéroïdes
        this.anims.create({
            key: 'tourner_normal',
            frames: this.anims.generateFrameNumbers('asteroide_sheet', { start: 0, end: 18 }),
            frameRate: 15, 
            repeat: -1
        });

        // Rotation anti-horaire des astéroïdes
        this.anims.create({
            key: 'tourner_inverse',
            frames: this.anims.generateFrameNumbers('asteroide_sheet', { start: 18, end: 0 }),
            frameRate: 15, 
            repeat: -1
        });

        // Animation de l'explosion (12 frames)
        this.anims.create({
            key: 'exploser',
            frames: this.anims.generateFrameNumbers('explosion_sheet', { start: 0, end: 11 }),
            frameRate: 22,
            repeat: 0 
        });

        // --- TRAÎNÉE DE PARTICULES DU RÉACTEUR (ORIENTÉE VERS LE BAS) ---
        this.creerTraineeReacteur();

        // --- TEXTES DE L'INTERFACE RETRO (HUD) ---
        this.scoreText = this.add.text(32, 24, 'SCORE : 0000', { 
            fontFamily: 'Courier, Monaco, monospace', 
            fontSize: '28px', 
            fontStyle: 'bold', 
            fill: '#38bdf8' 
        });

        this.powerupStatusText = this.add.text(32, 65, '', {
            fontFamily: 'Courier, Monaco, monospace',
            fontSize: '18px',
            fontStyle: 'bold',
            fill: '#f59e0b'
        });

        this.viesText = this.add.text(1280 - 240, 24, 'VIES : ❤️❤️❤️', { 
            fontFamily: 'Courier, Monaco, monospace', 
            fontSize: '28px', 
            fontStyle: 'bold', 
            fill: '#ef4444' 
        });

        // --- BOUCLE D'ÉVÉNEMENT (GÉNÉRATEUR D'ASTÉROÏDES) ---
        this.generateurAsteroides = this.time.addEvent({
            delay: 1500,
            callback: this.spawnAsteroide,
            callbackScope: this,
            loop: true
        });

        // --- COLLISIONS ET GESTION DES INTERACTIONS ---

        // 1. Collision Laser 💥 Astéroïde
        this.physics.add.overlap(this.lasers, this.asteroides, (laser, asteroide) => {
            const impactX = asteroide.x;
            const impactY = asteroide.y;
            const estGeant = asteroide.getData('type') === 'geant';

            laser.destroy();
            asteroide.destroy();

            if (estGeant) {
                // Scission en deux débris plus petits qui partent vers les côtés en tombant
                this.creerExplosion(impactX, impactY, 2.5);
                this.score += 20;

                for (let i = 0; i < 2; i++) {
                    let depris = this.asteroides.create(impactX, impactY, 'asteroide_sheet');
                    if (depris) {
                        depris.setScale(0.7);
                        depris.setData('type', 'normal');
                        depris.body.setCircle(22, 5, 5);
                        
                        let cleAnim = Phaser.Math.RND.pick(['tourner_normal', 'tourner_inverse']);
                        depris.play(cleAnim);
                        depris.anims.timeScale = Phaser.Math.FloatBetween(1.2, 2.2);

                        // Trajectoires divergentes vers le bas
                        let vx = i === 0 ? -120 : 120;
                        let vy = Phaser.Math.Between(320, 480); // Tombent rapidement
                        depris.setVelocity(vx, vy);
                        depris.body.setAllowGravity(false);
                    }
                }
            } else {
                this.creerExplosion(impactX, impactY, 1.3);
                this.score += 10;
            }

            this.scoreText.setText('SCORE : ' + String(this.score).padStart(4, '0'));

            // 15% de chance d'apparition d'un Power-up
            if (Phaser.Math.RND.between(1, 100) <= 15) {
                this.spawnPowerup(impactX, impactY);
            }
        });

        // 2. Collision Joueur 💥 Astéroïde
        this.physics.add.overlap(this.ship, this.asteroides, (vaisseau, asteroide) => {
            if (this.partieTerminee) return;

            const impactX = asteroide.x;
            const impactY = asteroide.y;

            if (this.hasShield) {
                asteroide.destroy();
                this.creerExplosion(impactX, impactY, 1.5);
                this.cameras.main.flash(100, 56, 189, 248);
                this.hasShield = false;
                return;
            }

            if (this.estInvulnerable) return;

            asteroide.destroy();
            this.creerExplosion(impactX, impactY, 2.0);
            this.cameras.main.shake(200, 0.02);

            this.vies--;
            let coeurs = '❤️'.repeat(Math.max(0, this.vies));
            this.viesText.setText('VIES : ' + (coeurs || '💀'));

            if (this.vies <= 0) {
                this.declencherGameOver();
            } else {
                this.activerInvulnerabilite();
            }
        });

        // 3. Collision Joueur 💥 Power-up
        this.physics.add.overlap(this.ship, this.powerups, (vaisseau, powerup) => {
            const type = powerup.getData('type');
            powerup.destroy();

            const tempsActuel = this.time.now;

            if (type === 'shield') {
                this.hasShield = true;
                this.shieldDuration = tempsActuel + 6000;
            } else if (type === 'triple') {
                this.aTripleTir = true;
                this.tripleShotDuration = tempsActuel + 8000;
            }
            
            this.cameras.main.flash(150, type === 'shield' ? 14 : 245, type === 'shield' ? 165 : 158, type === 'shield' ? 233 : 11);
        });
    }

    update(time, delta) {
        // Défilement vertical continu de l'espace (vers le bas)
        this.background.tilePositionY -= 3;

        if (this.partieTerminee) return;

        // --- GESTION DES MINUTEURS DES POWER-UPS ---
        let statusText = [];

        if (this.hasShield) {
            let tempsRestant = ((this.shieldDuration - time) / 1000).toFixed(1);
            if (tempsRestant > 0) {
                statusText.push(`🛡️ BOUCLIER: ${tempsRestant}s`);
            } else {
                this.hasShield = false;
            }
        }

        if (this.aTripleTir) {
            let tempsRestant = ((this.tripleShotDuration - time) / 1000).toFixed(1);
            if (tempsRestant > 0) {
                statusText.push(`⚡ MULTI-TIR: ${tempsRestant}s`);
            } else {
                this.aTripleTir = false;
            }
        }
        this.powerupStatusText.setText(statusText.join(' | '));

        // --- DIFFICULTÉ PROGRESSIVE ---
        let nouveauDelay = Math.max(500, 1500 - (this.score * 8));
        this.generateurAsteroides.delay = nouveauDelay;

        // --- TRACÉ VISUEL DU BOUCLIER ---
        if (this.hasShield) {
            this.shieldGraphics.clear();
            this.shieldGraphics.lineStyle(4, 0x0ea5e9, 0.8);
            this.shieldGraphics.fillStyle(0x38bdf8, 0.15);
            this.shieldGraphics.strokeCircle(this.ship.x, this.ship.y, 85);
            this.shieldGraphics.fillCircle(this.ship.x, this.ship.y, 85);
        } else {
            this.shieldGraphics.clear();
        }

        // --- DÉPLACEMENTS DU VAISSEAU ---
        const vitesse = 400;
        this.ship.setVelocity(0);

        if (this.cursors.left.isDown || this.touchesZQSD.left.isDown) {
            this.ship.setVelocityX(-vitesse);
        } else if (this.cursors.right.isDown || this.touchesZQSD.right.isDown) {
            this.ship.setVelocityX(vitesse);
        }

        if (this.cursors.up.isDown || this.touchesZQSD.up.isDown) {
            this.ship.setVelocityY(-vitesse);
        } else if (this.cursors.down.isDown || this.touchesZQSD.down.isDown) {
            this.ship.setVelocityY(vitesse);
        }

        // --- SYSTÈME DE TIR (VERS LE HAUT) ---
        if (this.spaceKey.isDown && time > this.prochainTir) {
            if (this.aTripleTir) {
                // 3 Lasers simultanés en éventail vertical
                let l1 = this.lasers.create(this.ship.x, this.ship.y - 60, 'laser');
                if (l1) {
                    if (!this.assetsSontVerticaux) {
                        l1.setAngle(-90);
                        l1.body.setSize(20, 100, true);
                    } else {
                        l1.body.setSize(100, 20, true);
                    }
                    l1.setVelocity(0, -900);
                    l1.setCollideWorldBounds(false);
                }

                let l2 = this.lasers.create(this.ship.x - 25, this.ship.y - 40, 'laser');
                if (l2) {
                    if (!this.assetsSontVerticaux) {
                        l2.setAngle(-100);
                        l2.body.setSize(20, 100, true);
                    } else {
                        l2.body.setSize(100, 20, true);
                    }
                    l2.setVelocity(-180, -900);
                    l2.setCollideWorldBounds(false);
                }

                let l3 = this.lasers.create(this.ship.x + 25, this.ship.y - 40, 'laser');
                if (l3) {
                    if (!this.assetsSontVerticaux) {
                        l3.setAngle(-80);
                        l3.body.setSize(20, 100, true);
                    } else {
                        l3.body.setSize(100, 20, true);
                    }
                    l3.setVelocity(180, -900);
                    l3.setCollideWorldBounds(false);
                }
            } else {
                // Tir simple vertical classique
                let laser = this.lasers.create(this.ship.x, this.ship.y - 60, 'laser');
                if (laser) {
                    if (!this.assetsSontVerticaux) {
                        laser.setAngle(-90);
                        laser.body.setSize(20, 100, true);
                    } else {
                        laser.body.setSize(100, 20, true);
                    }
                    laser.setVelocityY(-900);
                    laser.setCollideWorldBounds(false);
                }
            }
            this.prochainTir = time + 220; 
        }

        // --- NETTOYAGE MÉMOIRE ET SUPPRESSION DES OBJETS HORS-ECRAN ---
        let objetsADetruire = [];

        // Supprimer les lasers qui sortent par le haut de l'écran
        this.lasers.getChildren().forEach(l => {
            if (l.y < -100 || l.x < -100 || l.x > 1380) objetsADetruire.push(l);
        });

        // Supprimer les astéroïdes qui dépassent le bas de l'écran
        this.asteroides.getChildren().forEach(a => {
            if (a.y > 820) objetsADetruire.push(a);
        });

        // Supprimer les bonus qui dépassent le bas de l'écran
        this.powerups.getChildren().forEach(p => {
            if (p.y > 820) objetsADetruire.push(p);
        });

        objetsADetruire.forEach(obj => obj.destroy());
    }

    // --- MÉTHODES AUXILIAIRES ---

    spawnAsteroide() {
        if (this.partieTerminee) return;

        // Génération aléatoire sur l'axe horizontal X, au-dessus de l'écran (Y = -80)
        let xAleatoire = Phaser.Math.Between(50, 1230);
        let asteroide = this.asteroides.create(xAleatoire, -80, 'asteroide_sheet');

        if (asteroide) {
            let estGeant = Phaser.Math.RND.between(1, 100) <= 25;

            if (estGeant) {
                asteroide.setScale(1.8);
                asteroide.setData('type', 'geant');
                asteroide.body.setSize(55, 55, true);
            } else {
                asteroide.setScale(1.0);
                asteroide.setData('type', 'normal');
                asteroide.body.setCircle(28, 7, 7);
            }

            let cleAnim = Phaser.Math.RND.pick(['tourner_normal', 'tourner_inverse']);
            asteroide.play(cleAnim);
            asteroide.anims.timeScale = Phaser.Math.FloatBetween(0.6, 1.8);

            // Vitesse verticale de chute progressive basée sur le score actuel
            let bonusVitesse = Math.floor(this.score / 50) * 15;
            let vitesseVerticale = Phaser.Math.Between(180 + bonusVitesse, 380 + bonusVitesse);

            asteroide.setVelocityY(vitesseVerticale);
            asteroide.body.setAllowGravity(false);
        }
    }

    spawnPowerup(x, y) {
        let typePowerup = Phaser.Math.RND.pick(['shield', 'triple']);
        let texture = typePowerup === 'shield' ? 'powerup_shield' : 'powerup_triple';

        let powerup = this.powerups.create(x, y, texture);
        if (powerup) {
            powerup.setData('type', typePowerup);
            powerup.setVelocityY(150); // Descend doucement vers le joueur
            powerup.body.setAllowGravity(false);

            this.tweens.add({
                targets: powerup,
                scale: 1.25,
                duration: 500,
                yoyo: true,
                repeat: -1
            });
        }
    }

    creerExplosion(x, y, echelle) {
        let boom = this.add.sprite(x, y, 'explosion_sheet');
        boom.setScale(echelle);
        boom.play('exploser');
        boom.on('animationcomplete', () => boom.destroy());
    }

    activerInvulnerabilite() {
        this.estInvulnerable = true;
        this.tweens.add({
            targets: this.ship,
            alpha: 0.2,
            duration: 150,
            yoyo: true,
            repeat: 6,
            onComplete: () => {
                this.ship.alpha = 1.0;
                this.estInvulnerable = false;
            }
        });
    }

    creerTraineeReacteur() {
        // Positionnée en dessous du vaisseau (Y positif) et propulsée vers le bas
        try {
            this.engineParticles = this.add.particles(0, 0, 'explosion_sheet', {
                frame: 0,
                lifespan: 300,
                speedY: { min: 100, max: 250 }, // Propulsion vers le bas
                speedX: { min: -15, max: 15 },
                scale: { start: 0.5, end: 0 },
                blendMode: 'ADD',
                frequency: 25,
                follow: this.ship,
                followOffset: { x: 0, y: this.assetsSontVerticaux ? 80 : 60 }
            });
        } catch (e) {
            try {
                let particles = this.add.particles('explosion_sheet');
                this.engineParticles = particles.createEmitter({
                    frame: 0,
                    lifespan: 300,
                    speedY: { min: 100, max: 250 },
                    speedX: { min: -15, max: 15 },
                    scale: { start: 0.5, end: 0 },
                    blendMode: 'ADD',
                    frequency: 25
                });
                this.engineParticles.startFollow(this.ship, 0, this.assetsSontVerticaux ? 80 : 60);
            } catch (err) {
                console.warn("Création des particules de réacteur impossible.");
            }
        }
    }

    declencherGameOver() {
        this.partieTerminee = true;

        if (this.generateurAsteroides) this.generateurAsteroides.destroy();
        if (this.engineParticles) this.engineParticles.destroy();
        
        this.ship.setVelocity(0);
        this.ship.alpha = 0.5;

        this.asteroides.getChildren().forEach(a => a.setVelocity(0));
        this.powerups.getChildren().forEach(p => p.setVelocity(0));

        const overlay = this.add.graphics();
        overlay.fillStyle(0x000000, 0.75);
        overlay.fillRect(0, 0, 1280, 720);

        this.add.text(640, 280, 'PARTIE TERMINÉE', {
            fontFamily: 'Courier, Monaco, monospace',
            fontSize: '64px',
            fontStyle: 'bold',
            fill: '#ef4444'
        }).setOrigin(0.5);

        this.add.text(640, 360, `Score Final : ${this.score} points`, {
            fontFamily: 'Courier, Monaco, monospace',
            fontSize: '28px',
            fill: '#f3f4f6'
        }).setOrigin(0.5);

        const boutonRecommencer = this.add.text(640, 460, ' CLIQUER POUR RECOMMENCER ', {
            fontFamily: 'Courier, Monaco, monospace',
            fontSize: '24px',
            fill: '#22c55e',
            backgroundColor: '#14532d',
            padding: { x: 20, y: 10 }
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });

        boutonRecommencer.on('pointerdown', () => this.scene.restart());
        boutonRecommencer.on('pointerover', () => boutonRecommencer.setStyle({ fill: '#4ade80', backgroundColor: '#166534' }));
        boutonRecommencer.on('pointerout', () => boutonRecommencer.setStyle({ fill: '#22c55e', backgroundColor: '#14532d' }));
    }

    // --- GESTIONNAIRE DE GRAPHISMES PROCÉDURAUX (FALLBACK ANTI-CRASH) ---
    genererTexturesDeSecours() {
        // Bouclier
        if (!this.textures.exists('powerup_shield')) {
            const canvas = document.createElement('canvas');
            canvas.width = 36; canvas.height = 36;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#0ea5e9'; ctx.beginPath(); ctx.arc(18, 18, 14, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3; ctx.stroke();
            this.textures.addCanvas('powerup_shield', canvas);
        }

        // Triple tir
        if (!this.textures.exists('powerup_triple')) {
            const canvas = document.createElement('canvas');
            canvas.width = 36; canvas.height = 36;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#f59e0b'; ctx.beginPath(); ctx.arc(18, 18, 14, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3; ctx.stroke();
            this.textures.addCanvas('powerup_triple', canvas);
        }

        // Fond étoilé
        if (!this.textures.exists('background')) {
            const canvas = document.createElement('canvas');
            canvas.width = 512; canvas.height = 512;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#0b0f19'; ctx.fillRect(0, 0, 512, 512);
            ctx.fillStyle = '#ffffff';
            for (let i = 0; i < 60; i++) {
                ctx.fillRect(Math.random() * 512, Math.random() * 512, 1.5, 1.5);
            }
            this.textures.addCanvas('background', canvas);
        }

        // Vaisseau spatial
        if (!this.textures.exists('ship')) {
            const canvas = document.createElement('canvas');
            canvas.width = 176 * 3; canvas.height = 96;
            const ctx = canvas.getContext('2d');
            for (let f = 0; f < 3; f++) {
                const ox = f * 176;
                ctx.fillStyle = f === 0 ? '#ff3b30' : f === 1 ? '#ffcc00' : '#ff9500';
                ctx.beginPath(); ctx.moveTo(ox + 10, 48); ctx.lineTo(ox + 35, 30); ctx.lineTo(ox + 35, 66); ctx.closePath(); ctx.fill();
                ctx.fillStyle = '#38bdf8'; ctx.beginPath();
                ctx.moveTo(ox + 30, 24); ctx.lineTo(ox + 140, 48); ctx.lineTo(ox + 30, 72); ctx.closePath(); ctx.fill();
                ctx.fillStyle = '#ffffff'; ctx.beginPath();
                ctx.moveTo(ox + 70, 40); ctx.lineTo(ox + 110, 48); ctx.lineTo(ox + 70, 56); ctx.closePath(); ctx.fill();
            }
            this.textures.addCanvas('ship', canvas);
        }

        // Laser
        if (!this.textures.exists('laser')) {
            const canvas = document.createElement('canvas');
            canvas.width = 170; canvas.height = 90;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#22c55e'; ctx.fillRect(20, 42, 110, 6);
            this.textures.addCanvas('laser', canvas);
        }

        // Astéroïdes
        if (!this.textures.exists('asteroide_sheet')) {
            const canvas = document.createElement('canvas');
            canvas.width = 70 * 19; canvas.height = 70;
            const ctx = canvas.getContext('2d');
            for (let i = 0; i < 19; i++) {
                const ox = i * 70;
                ctx.save();
                ctx.translate(ox + 35, 35);
                ctx.rotate((i * Math.PI * 2) / 19);
                ctx.fillStyle = '#64748b'; ctx.beginPath();
                ctx.arc(0, 0, 26, 0, Math.PI * 2); ctx.fill();
                ctx.fillStyle = '#475569'; ctx.beginPath(); ctx.arc(-10, -8, 6, 0, Math.PI * 2); ctx.fill();
                ctx.beginPath(); ctx.arc(8, 8, 4, 0, Math.PI * 2); ctx.fill();
                ctx.restore();
            }
            this.textures.addCanvas('asteroide_sheet', canvas);
        }

        // Explosion
        if (!this.textures.exists('explosion_sheet')) {
            const canvas = document.createElement('canvas');
            canvas.width = 64 * 12; canvas.height = 64;
            const ctx = canvas.getContext('2d');
            for (let i = 0; i < 12; i++) {
                const ox = i * 64;
                ctx.fillStyle = `rgba(239, 68, 68, ${1 - i / 12})`;
                ctx.beginPath(); ctx.arc(ox + 32, 32, 5 + i * 2.3, 0, Math.PI * 2); ctx.fill();
                ctx.fillStyle = `rgba(251, 146, 60, ${1 - i / 12})`;
                ctx.beginPath(); ctx.arc(ox + 32, 32, 2 + i * 1.5, 0, Math.PI * 2); ctx.fill();
            }
            this.textures.addCanvas('explosion_sheet', canvas);
        }
    }
}