export class Start extends Phaser.Scene {

    constructor() {
        super('Start');
    }

    preload() {
        // Chargement des images et spritesheets depuis tes dossiers locaux
        this.load.image('background', 'assets/background/darkPurple.png');
        this.load.spritesheet('ship', 'assets/PNG/playerShip1_red.png', { frameWidth: 99, frameHeight: 75 });
        this.load.spritesheet('laser', 'assets/PNG/Lasers/laserGreen02.png', { frameWidth: 13, frameHeight: 57 });
        
        // Assets pour l'ennemi et ses lasers
        this.load.spritesheet('enemy', 'assets/PNG/Enemies/enemyBlack1.png', { frameWidth: 93, frameHeight: 84 });
        this.load.image('enemy_laser', 'assets/PNG/Lasers/laserRed01.png');

        // Préchargement des nouveaux bonus locaux (Power-ups) avec vos fichiers d'images
        this.load.image('powerup_shield', 'assets/PNG/Power-ups/powerupRed_shield.png');
        this.load.image('powerup_triple', 'assets/PNG/Power-ups/powerupRed_bolt.png');
        
        // Nouveau Power-up : Soin / Réparation
        this.load.image('powerup_heal', 'assets/PNG/Power-ups/pill_red.png');

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

        // --- CHARGEMENT DES ASSETS AUDIO ---
        this.load.audio('laser_player', 'assets/audio/laser_player.ogg');
        this.load.audio('laser_enemy', 'assets/audio/laser_enemy.ogg');
        this.load.audio('explosion', 'assets/audio/explosion.ogg');
        this.load.audio('powerup', 'assets/audio/powerup.ogg');
        this.load.audio('damage', 'assets/audio/damage.ogg');
        this.load.audio('gameover', 'assets/audio/gameover.ogg');
        this.load.audio('dash', 'assets/audio/dash.ogg');
        this.load.audio('bg_music', 'assets/audio/bg_music.mp3');
    }

    create() {
        // 1. CONFIGURATION DES ASSETS (Horizontal vs Vertical)
        // Comme défini dans vos assets locaux, nous configurons sur true (les vaisseaux pointent par défaut vers le haut/bas)
        this.assetsSontVerticaux = true;

        // GÉNÉRATEUR AUTOMATIQUE DE TEXTURES DE SECOURS (Anti-Crash & Slicing correct)
        //this.genererTexturesDeSecours();

        // 2. INITIALISATION DES VARIABLES DU GAMEPLAY
        this.score = 0;
        this.vies = 3;
        this.estInvulnerable = false;
        this.partieTerminee = false;
        this.prochainTir = 0;

        // Système d'armement évolutif
        this.niveauArme = 1; // Niveau 1 à 3
        this.tempsOverdrive = 0; // Fin de l'Overdrive en ms
        this.cadenceTirBase = 220; // Délai standard entre tirs
        this.cadenceTirOverdrive = 100; // Délai ultra-rapide

        // Système de Combo
        this.combo = 0;
        this.tempsDernierKill = 0;
        this.dureeComboMax = 3000; // 3 secondes pour enchaîner

        // Système de Dash (Esquive)
        this.dernierDash = 0;
        this.cooldownDash = 1500; // Temps de recharge de 1.5s
        this.dureeDash = 150; // Durée de l'esquive ultra-rapide
        this.estEnDash = false;
        this.dashDirectionX = 0;
        this.dashDirectionY = 0;

        // Statuts des Power-ups
        this.hasShield = false;
        this.shieldDuration = 0;

        // Parallaxe de fond étoilé (Défilement vertical)
        this.background = this.add.tileSprite(640, 360, 1280, 720, 'background');

        // Création du vaisseau joueur (Centré en bas de l'écran)
        this.ship = this.physics.add.sprite(640, 600, 'ship');
        this.ship.setCollideWorldBounds(true);
        
        // Ajustement dynamique de la hitbox selon l'axe de l'asset (Pixel-Perfect Kenny)
        if (!this.assetsSontVerticaux) {
            this.ship.setAngle(-90); 
            this.ship.body.setSize(50, 90, true); 
        } else {
            this.ship.body.setSize(80, 65, true); // Ajustement précis pour playerShip1_red
        }

        // Graphismes pour dessiner les effets visuels dynamiques
        this.shieldGraphics = this.add.graphics();
        this.interfaceGraphics = this.add.graphics();

        // Assignation des touches de contrôle
        this.cursors = this.input.keyboard.createCursorKeys();
        this.touchesZQSD = this.input.keyboard.addKeys({
            up: Phaser.Input.Keyboard.KeyCodes.Z,
            down: Phaser.Input.Keyboard.KeyCodes.S,
            left: Phaser.Input.Keyboard.KeyCodes.Q,
            right: Phaser.Input.Keyboard.KeyCodes.D
        });
        this.spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
        this.shiftKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT);

        // Groupes d'objets physiques
        this.lasers = this.physics.add.group();
        this.asteroides = this.physics.add.group();
        this.enemies = this.physics.add.group();
        this.enemyLasers = this.physics.add.group();
        this.powerups = this.physics.add.group();

        // --- CRÉATION ET CONFIGURATION DES ANIMATIONS ---
        
        // Vol du joueur (support anti-crash)
        if (this.anims.exists('fly')) this.anims.remove('fly');
        this.ship.anims.create({
            key: 'fly',
            frames: this.anims.generateFrameNumbers('ship', { start: 0, end: this.textures.get('ship').frameTotal >= 4 ? 2 : 0 }),
            frameRate: 15,
            repeat: -1
        });
        this.ship.play('fly');

        // Vol de l'ennemi
        if (this.anims.exists('enemy_fly')) this.anims.remove('enemy_fly');
        this.anims.create({
            key: 'enemy_fly',
            frames: this.anims.generateFrameNumbers('enemy', { start: 0, end: this.textures.get('enemy').frameTotal >= 4 ? 2 : 0 }),
            frameRate: 12,
            repeat: -1
        });

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

        // Animation de l'explosion
        this.anims.create({
            key: 'exploser',
            frames: this.anims.generateFrameNumbers('explosion_sheet', { start: 0, end: 11 }),
            frameRate: 22,
            repeat: 0 
        });

        // --- TRAÎNÉE DE PARTICULES DU RÉACTEUR DU JOUEUR ---
        this.creerTraineeReacteur();

        // --- TEXTES DE L'INTERFACE RETRO (HUD) ---
        this.scoreText = this.add.text(32, 24, 'SCORE : 0000', { 
            fontFamily: 'Courier, Monaco, monospace', 
            fontSize: '28px', 
            fontStyle: 'bold', 
            fill: '#38bdf8' 
        });

        this.armeText = this.add.text(32, 60, 'ARME : NIV. 1', { 
            fontFamily: 'Courier, Monaco, monospace', 
            fontSize: '20px', 
            fontStyle: 'bold', 
            fill: '#4ade80' 
        });

        this.comboText = this.add.text(32, 92, '', { 
            fontFamily: 'Courier, Monaco, monospace', 
            fontSize: '24px', 
            fontStyle: 'bold', 
            fill: '#fb7185' 
        });

        this.powerupStatusText = this.add.text(32, 126, '', {
            fontFamily: 'Courier, Monaco, monospace',
            fontSize: '18px',
            fontStyle: 'bold',
            fill: '#f59e0b'
        });

        this.viesText = this.add.text(1280 - 360, 24, 'VIES : ❤️❤️❤️', { 
            fontFamily: 'Courier, Monaco, monospace', 
            fontSize: '28px', 
            fontStyle: 'bold', 
            fill: '#ef4444' 
        });

        this.dashText = this.add.text(1280 - 360, 60, 'DASH : PRÊT ⚡', { 
            fontFamily: 'Courier, Monaco, monospace', 
            fontSize: '20px', 
            fontStyle: 'bold', 
            fill: '#38bdf8' 
        });

        // --- BOUCLES D'ÉVÉNEMENTS (GÉNÉRATEURS D'OBSTACLES ET D'ENNEMIS) ---
        this.generateurAsteroides = this.time.addEvent({
            delay: 1500,
            callback: this.spawnAsteroide,
            callbackScope: this,
            loop: true
        });

        this.generateurEnemies = this.time.addEvent({
            delay: 2600, // Légère réduction pour augmenter l'intensité
            callback: this.spawnEnemy,
            callbackScope: this,
            loop: true
        });

        // --- CONFIGURATION DE LA MUSIQUE DE FOND ---
        try {
            // CORRECTION : Utilisation de this.cache.audio.exists au lieu de this.sound.exists
            if (this.cache.audio.exists('bg_music')) {
                this.bgMusic = this.sound.add('bg_music', { loop: true, volume: 0.35 });
                this.bgMusic.play();
            }
        } catch (e) {
            console.warn("Échec de l'initialisation de la musique physique de fond.", e);
        }

        // Déverrouillage Web Audio lors de la première interaction clavier de l'utilisateur (Sécurité navigateur)
        this.input.keyboard.on('keydown', () => {
            try {
                if (this.sound.context && this.sound.context.state === 'suspended') {
                    this.sound.context.resume();
                }
                if (this.bgMusic && !this.bgMusic.isPlaying && !this.partieTerminee) {
                    this.bgMusic.play();
                }
            } catch (e) {}
        });

        // --- COLLISIONS ET GESTION DES INTERACTIONS ---

        // 1. Collision Laser Joueur 💥 Astéroïde
        this.physics.add.overlap(this.lasers, this.asteroides, (laser, asteroide) => {
            const impactX = asteroide.x;
            const impactY = asteroide.y;
            const estGeant = asteroide.getData('type') === 'geant';

            laser.destroy();
            asteroide.destroy();

            if (estGeant) {
                this.creerExplosion(impactX, impactY, 2.5);
                this.creerEclatsDebris(impactX, impactY, 0x64748b);
                this.declencherCombo(20, impactX, impactY);

                for (let i = 0; i < 2; i++) {
                    let depris = this.asteroides.create(impactX, impactY, 'asteroide_sheet');
                    if (depris) {
                        depris.setScale(0.7);
                        depris.setData('type', 'normal');
                        depris.body.setCircle(22, 5, 5);
                        
                        let cleAnim = Phaser.Math.RND.pick(['tourner_normal', 'tourner_inverse']);
                        depris.play(cleAnim);
                        depris.anims.timeScale = Phaser.Math.FloatBetween(1.2, 2.2);

                        let vx = i === 0 ? -120 : 120;
                        let vy = Phaser.Math.Between(320, 480);
                        depris.setVelocity(vx, vy);
                        depris.body.setAllowGravity(false);
                    }
                }
            } else {
                this.creerExplosion(impactX, impactY, 1.3);
                this.creerEclatsDebris(impactX, impactY, 0x64748b);
                this.declencherCombo(10, impactX, impactY);
            }

            if (Phaser.Math.RND.between(1, 100) <= 15) {
                this.spawnPowerup(impactX, impactY);
            }
        });

        // 2. Collision Laser Joueur 💥 Vaisseau Ennemi (Intègre les points de vie des Élites)
        this.physics.add.overlap(this.lasers, this.enemies, (laser, enemy) => {
            const impactX = enemy.x;
            const impactY = enemy.y;

            laser.destroy();
            
            let hp = enemy.getData('hp') || 1;
            hp--;
            enemy.setData('hp', hp);

            // Flasher l'ennemi en blanc pour indiquer l'impact
            enemy.setTint(0xffffff);
            this.time.delayedCall(80, () => {
                if (enemy && enemy.active) {
                    // Restaurer la couleur d'origine ou la couleur Elite
                    if (enemy.getData('behavior') === 'elite') {
                        enemy.setTint(0xfacc15); // Or élite
                    } else {
                        enemy.clearTint();
                    }
                }
            });

            if (hp <= 0) {
                this.detruireEnnemi(enemy); 
                this.creerExplosion(impactX, impactY, enemy.getData('behavior') === 'elite' ? 3.0 : 2.0);
                this.creerEclatsDebris(impactX, impactY, enemy.getData('behavior') === 'elite' ? 0xfacc15 : 0xec4899);
                
                let pointsDeBase = enemy.getData('behavior') === 'elite' ? 150 : 50;
                this.declencherCombo(pointsDeBase, impactX, impactY);

                // Dropper systématiquement un bonus sur les Élite, 25% de chance sur les autres
                if (enemy.getData('behavior') === 'elite' || Phaser.Math.RND.between(1, 100) <= 25) {
                    this.spawnPowerup(impactX, impactY);
                }
            } else {
                this.creerExplosion(impactX, impactY, 0.7); // Micro-explosion pour l'impact
            }
        });

        // 3. Collision Joueur 💥 Astéroïde
        this.physics.add.overlap(this.ship, this.asteroides, (vaisseau, asteroide) => {
            const impactX = asteroide.x;
            const impactY = asteroide.y;
            asteroide.destroy();
            this.degatsJoueur(impactX, impactY);
        });

        // 4. Collision Joueur 💥 Vaisseau Ennemi
        this.physics.add.overlap(this.ship, this.enemies, (vaisseau, enemy) => {
            const impactX = enemy.x;
            const impactY = enemy.y;
            this.detruireEnnemi(enemy);
            this.degatsJoueur(impactX, impactY);
        });

        // 5. Collision Joueur 💥 Laser Ennemi
        this.physics.add.overlap(this.ship, this.enemyLasers, (vaisseau, laserEnnemi) => {
            const impactX = laserEnnemi.x;
            const impactY = laserEnnemi.y;
            laserEnnemi.destroy();
            this.degatsJoueur(impactX, impactY);
        });

        // 6. Collision Joueur 💥 Power-up (Gère le soin et l'évolution d'arme)
        this.physics.add.overlap(this.ship, this.powerups, (vaisseau, powerup) => {
            const type = powerup.getData('type');
            powerup.destroy();

            const tempsActuel = this.time.now;

            this.jouerSon('powerup'); // Effet sonore d'acquisition

            if (type === 'shield') {
                this.hasShield = true;
                this.shieldDuration = tempsActuel + 6000;
                this.cameras.main.flash(150, 56, 189, 248);
            } else if (type === 'triple') {
                // Système d'upgrade d'armement progressif
                if (this.niveauArme < 3) {
                    this.niveauArme++;
                    this.cameras.main.flash(150, 74, 222, 128);
                } else {
                    // Surcharger si déjà au max
                    this.tempsOverdrive = tempsActuel + 6000;
                    this.cameras.main.flash(150, 245, 158, 11);
                }
            } else if (type === 'heal') {
                // Régénération de vie (Max 5)
                this.vies = Math.min(5, this.vies + 1);
                this.viesText.setText('VIES : ' + '❤️'.repeat(this.vies));
                this.cameras.main.flash(150, 239, 68, 68);
            }
            
            this.mettreAJourTexteArme(tempsActuel);
        });
    }

    update(time, delta) {
        // Défilement vertical continu de l'espace (vers le bas)
        this.background.tilePositionY -= 3;

        if (this.partieTerminee) return;

        // Nettoyage et dessin de l'interface dynamique (Barres de vie des Élites)
        this.interfaceGraphics.clear();

        // --- GESTION DES MINUTEURS DES POWER-UPS & ARME ---
        let statusText = [];

        if (this.hasShield) {
            let tempsRestant = ((this.shieldDuration - time) / 1000).toFixed(1);
            if (tempsRestant > 0) {
                statusText.push(`🛡️ BOUCLIER: ${tempsRestant}s`);
            } else {
                this.hasShield = false;
            }
        }

        if (this.tempsOverdrive > time) {
            let tempsRestant = ((this.tempsOverdrive - time) / 1000).toFixed(1);
            if (tempsRestant > 0) {
                statusText.push(`🔥 OVERDRIVE: ${tempsRestant}s`);
            }
        }
        this.powerupStatusText.setText(statusText.join(' | '));
        this.mettreAJourTexteArme(time);

        // --- DIFFICULTÉ PROGRESSIVE ---
        let nouveauDelay = Math.max(500, 1500 - (this.score * 8));
        this.generateurAsteroides.delay = nouveauDelay;

        // --- GESTION ET AFFICHAGE DU MULTIPLICATEUR COMBO ---
        if (this.combo > 0 && time > this.tempsDernierKill + this.dureeComboMax) {
            this.combo = 0;
        }

        if (this.combo > 1) {
            this.comboText.setText(`COMBO : x${Math.min(this.combo, 5)}`);
            if (this.combo >= 5) {
                this.comboText.setFill('#f43f5e'); // Rose néon max
            } else if (this.combo >= 3) {
                this.comboText.setFill('#fb923c'); // Orange
            } else {
                this.comboText.setFill('#facc15'); // Jaune
            }
        } else {
            this.comboText.setText('');
        }

        // --- RECHARGE DE L'INDICATEUR DE DASH ---
        let tempsRestantDash = (this.dernierDash + this.cooldownDash) - time;
        if (tempsRestantDash > 0) {
            let pct = Math.floor((1 - (tempsRestantDash / this.cooldownDash)) * 100);
            this.dashText.setText(`DASH : RECHARGE (${pct}%)`);
            this.dashText.setFill('#f43f5e');
        } else {
            this.dashText.setText('DASH : PRÊT ⚡');
            this.dashText.setFill('#38bdf8');
        }

        // --- TRACÉ VISUEL DU BOUCLIER ---
        if (this.hasShield) {
            this.shieldGraphics.clear();
            this.shieldGraphics.lineStyle(4, 0x0ea5e9, 0.8);
            this.shieldGraphics.fillStyle(0x38bdf8, 0.15);
            this.shieldGraphics.strokeCircle(this.ship.x, this.ship.y, 75);
            this.shieldGraphics.fillCircle(this.ship.x, this.ship.y, 75);
        } else {
            this.shieldGraphics.clear();
        }

        // --- DÉPLACEMENTS DU VAISSEAU JOUEUR & GESTION DU DASH ---
        const vitesse = 400;

        if (this.shiftKey.isDown && time > this.dernierDash + this.cooldownDash && !this.estEnDash) {
            let dx = 0;
            let dy = 0;
            
            if (this.cursors.left.isDown || this.touchesZQSD.left.isDown) dx = -1;
            else if (this.cursors.right.isDown || this.touchesZQSD.right.isDown) dx = 1;
            
            if (this.cursors.up.isDown || this.touchesZQSD.up.isDown) dy = -1;
            else if (this.cursors.down.isDown || this.touchesZQSD.down.isDown) dy = 1;
            
            if (dx === 0 && dy === 0) dy = -1; // Dash vers le haut par défaut
            
            let len = Math.sqrt(dx*dx + dy*dy);
            dx /= len;
            dy /= len;
            
            this.estEnDash = true;
            this.tempsFinDash = time + this.dureeDash;
            this.dernierDash = time;
            this.dashDirectionX = dx;
            this.dashDirectionY = dy;
            
            this.estInvulnerable = true;
            this.cameras.main.shake(120, 0.01);
            this.jouerSon('dash'); // Son d'accélération / dash
        }

        if (this.estEnDash) {
            this.ship.setVelocity(this.dashDirectionX * 1200, this.dashDirectionY * 1200);
            
            // Effet fantôme stylisé
            if (Math.floor(time) % 2 === 0) {
                let ghost = this.add.sprite(this.ship.x, this.ship.y, 'ship');
                ghost.setAngle(this.ship.angle);
                ghost.setScale(this.ship.scaleX);
                ghost.setAlpha(0.5);
                ghost.setTint(0x38bdf8);
                this.tweens.add({
                    targets: ghost,
                    alpha: 0,
                    scale: 0.8,
                    duration: 250,
                    onComplete: () => ghost.destroy()
                });
            }
            
            if (time > this.tempsFinDash) {
                this.estEnDash = false;
                this.estInvulnerable = false;
            }
        } else {
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
        }

        // --- INTELLIGENCE ARTIFICIELLE & MOUVEMENTS ENNEMIS ---
        this.enemies.getChildren().forEach(enemy => {
            if (!enemy || !enemy.active) return;

            let behavior = enemy.getData('behavior');

            // Dessin dynamique de la jauge de vie pour les Élites
            if (behavior === 'elite') {
                let hp = enemy.getData('hp');
                let hpMax = 4;
                if (hp > 0) {
                    let bx = enemy.x - 30;
                    let by = enemy.y - 65;
                    this.interfaceGraphics.fillStyle(0x1e293b, 0.8);
                    this.interfaceGraphics.fillRect(bx, by, 60, 6);
                    this.interfaceGraphics.fillStyle(0xef4444, 1.0);
                    this.interfaceGraphics.fillRect(bx, by, 60 * (hp / hpMax), 6);
                }
            }

            if (behavior === 'tracker') {
                let diffX = this.ship.x - enemy.x;
                enemy.setVelocityX(diffX * 2.5);
            } 
            else if (behavior === 'sine') {
                let phaseOffset = enemy.getData('sinOffset');
                enemy.setVelocityX(Math.sin((time + phaseOffset) / 250) * 300);
            } 
            else if (behavior === 'kamikaze') {
                let distance = Phaser.Math.Distance.Between(enemy.x, enemy.y, this.ship.x, this.ship.y);
                if (distance < 420 && !enemy.getData('hasCharged')) {
                    enemy.setData('hasCharged', true);
                    let angleCharge = Phaser.Math.Angle.Between(enemy.x, enemy.y, this.ship.x, this.ship.y);
                    this.physics.velocityFromRotation(angleCharge, 650, enemy.body.velocity);
                }

                if (enemy.getData('hasCharged')) {
                    let currentAngle = Math.atan2(enemy.body.velocity.y, enemy.body.velocity.x);
                    if (!this.assetsSontVerticaux) {
                        enemy.setRotation(currentAngle);
                    } else {
                        enemy.setRotation(currentAngle - Math.PI / 2);
                    }
                    
                    let angleToPlayer = Phaser.Math.Angle.Between(enemy.x, enemy.y, this.ship.x, this.ship.y);
                    let newAngle = Phaser.Math.Angle.RotateTo(currentAngle, angleToPlayer, 0.04); 
                    this.physics.velocityFromRotation(newAngle, 650, enemy.body.velocity);
                }
            }
            else if (behavior === 'looping') {
                let elapsed = enemy.getData('elapsed') + delta;
                enemy.setData('elapsed', elapsed);

                let t = elapsed / 1000;
                let omega = 5;
                let radius = 110;
                let driftSpeed = 130;

                let vx = -radius * omega * Math.sin(omega * t);
                let vy = driftSpeed + radius * omega * Math.cos(omega * t);

                enemy.setVelocity(vx, vy);

                let currentAngle = Math.atan2(vy, vx);
                if (!this.assetsSontVerticaux) {
                    enemy.setRotation(currentAngle);
                } else {
                    enemy.setRotation(currentAngle - Math.PI / 2);
                }
            }
            else if (behavior === 'elite') {
                // Déplacement horizontal lent et descente très progressive
                let phaseOffset = enemy.getData('sinOffset');
                enemy.setVelocityX(Math.sin((time + phaseOffset) / 400) * 150);
            }
        });

        // --- SYSTÈME DE TIR DU JOUEUR (AVEC ARME ÉVOLUTIVE) ---
        if (this.spaceKey.isDown && time > this.prochainTir && !this.estEnDash) {
            let estEnOverdrive = this.tempsOverdrive > time;
            let cadence = estEnOverdrive ? this.cadenceTirOverdrive : this.cadenceTirBase;

            this.tirerJoueur(estEnOverdrive);
            this.prochainTir = time + cadence; 
        }

        // --- NETTOYAGE MÉMOIRE ET SUPPRESSION DES OBJETS HORS-ECRAN ---
        let objetsADetruire = [];

        this.lasers.getChildren().forEach(l => {
            if (l.y < -100 || l.x < -100 || l.x > 1380) objetsADetruire.push(l);
        });

        this.enemyLasers.getChildren().forEach(el => {
            if (el.y > 820 || el.x < -100 || el.x > 1380) objetsADetruire.push(el);
        });

        this.asteroides.getChildren().forEach(a => {
            if (a.y > 820) objetsADetruire.push(a);
        });

        this.enemies.getChildren().forEach(e => {
            if (e.y > 820) {
                objetsADetruire.push(e);
            }
        });

        this.powerups.getChildren().forEach(p => {
            if (p.y > 820) objetsADetruire.push(p);
        });

        objetsADetruire.forEach(obj => {
            if (this.enemies.contains(obj)) {
                this.detruireEnnemi(obj);
            } else {
                obj.destroy();
            }
        });
    }

    // --- SYSTÈME DE TIR JOUEUR ---
    tirerJoueur(estEnOverdrive) {
        const laserTexture = 'laser';
        const angleInitial = !this.assetsSontVerticaux ? -90 : 0;
        const vitesseLaser = 900;

        // Définir la couleur du laser (Overdrive = doré)
        const couleurLaser = estEnOverdrive ? 0xfacc15 : 0xffffff;

        this.jouerSon('laser_player'); // Son de tir joueur

        const configurerLaser = (laser, vx, vy, rotAngle) => {
            if (!laser) return;
            laser.setCollideWorldBounds(false);
            laser.setTint(couleurLaser);
            laser.setVelocity(vx, vy);
            
            if (!this.assetsSontVerticaux) {
                laser.setAngle(angleInitial + rotAngle);
                laser.body.setSize(20, 100, true);
            } else {
                laser.setAngle(rotAngle);
                laser.body.setSize(15, 60, true); // S'adapte au laserGreen02 étroit vertical
            }
        };

        if (this.niveauArme === 1) {
            // Tir simple
            let l = this.lasers.create(this.ship.x, this.ship.y - 45, laserTexture);
            configurerLaser(l, 0, -vitesseLaser, 0);
        } 
        else if (this.niveauArme === 2) {
            // Double tir parallèle depuis les ailes
            let lLeft = this.lasers.create(this.ship.x - 30, this.ship.y - 20, laserTexture);
            let lRight = this.lasers.create(this.ship.x + 30, this.ship.y - 20, laserTexture);
            configurerLaser(lLeft, 0, -vitesseLaser, 0);
            configurerLaser(lRight, 0, -vitesseLaser, 0);
        } 
        else if (this.niveauArme === 3) {
            // Triple tir spread (éventail)
            let lCenter = this.lasers.create(this.ship.x, this.ship.y - 45, laserTexture);
            let lLeft = this.lasers.create(this.ship.x - 20, this.ship.y - 30, laserTexture);
            let lRight = this.lasers.create(this.ship.x + 20, this.ship.y - 30, laserTexture);
            
            configurerLaser(lCenter, 0, -vitesseLaser, 0);
            configurerLaser(lLeft, -160, -vitesseLaser, -10);
            configurerLaser(lRight, 160, -vitesseLaser, 10);
        }
    }

    mettreAJourTexteArme(time) {
        if (this.tempsOverdrive > time) {
            this.armeText.setText('ARME : OVERDRIVE 🔥');
            this.armeText.setFill('#f97316'); // Orange vif
        } else {
            this.armeText.setText('ARME : NIVEAU ' + this.niveauArme);
            this.armeText.setFill('#4ade80'); // Vert standard
        }
    }

    // --- SYSTÈME DE COMBO MULTIPLICATEUR ---
    declencherCombo(pointsDeBase, x, y) {
        this.combo++;
        this.tempsDernierKill = this.time.now;
        
        // Multiplicateur plafonné à x5
        let multiplicateur = Math.min(this.combo, 5);
        let scoreFinal = pointsDeBase * multiplicateur;
        
        this.score += scoreFinal;
        this.scoreText.setText('SCORE : ' + String(this.score).padStart(4, '0'));

        // Texte flottant d'arcade
        let message = `+${scoreFinal}`;
        if (multiplicateur > 1) {
            message += ` x${multiplicateur}`;
        }
        
        let couleurTxt = '#38bdf8'; // Cyan
        if (multiplicateur >= 5) couleurTxt = '#ef4444'; // Rouge
        else if (multiplicateur >= 3) couleurTxt = '#facc15'; // Jaune

        this.creerTexteFlottant(x, y, message, couleurTxt);
    }

    creerTexteFlottant(x, y, message, couleur) {
        let txt = this.add.text(x, y, message, {
            fontFamily: 'Courier, Monaco, monospace',
            fontSize: '22px',
            fontStyle: 'bold',
            fill: couleur
        }).setOrigin(0.5);

        this.tweens.add({
            targets: txt,
            y: y - 60,
            alpha: 0,
            duration: 800,
            onComplete: () => {
                txt.destroy();
            }
        });
    }

    creerEclatsDebris(x, y, couleur) {
        try {
            this.add.particles(x, y, 'explosion_sheet', {
                frame: 0,
                lifespan: 400,
                speed: { min: 120, max: 280 },
                scale: { start: 0.25, end: 0 },
                blendMode: 'ADD',
                emitting: false,
                quantity: 12,
                tint: couleur
            }).explode();
        } catch (e) {
            // Protection anti-crash
        }
    }

    // --- MÉTHODES AUXILIAIRES ---

    spawnAsteroide() {
        if (this.partieTerminee) return;

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

            let bonusVitesse = Math.floor(this.score / 100) * 5;
            let vitesseVerticale = Phaser.Math.Between(100 + bonusVitesse, 220 + bonusVitesse);

            asteroide.setVelocityY(vitesseVerticale);
            asteroide.body.setAllowGravity(false);
        }
    }

    spawnEnemy() {
        if (this.partieTerminee) return;

        let xAleatoire = Phaser.Math.Between(150, 1130);
        let enemy = this.enemies.create(xAleatoire, -80, 'enemy');

        if (enemy) {
            // Choisir dynamiquement l'IA de l'ennemi. Les Élites apparaissent plus fréquemment à haut score.
            let comportementsPossibles = ['tracker', 'sine', 'kamikaze', 'looping'];
            
            // Apparition d'Élites basée sur un score minimum de 300
            let comportementChoisi;
            if (this.score >= 300 && Phaser.Math.RND.between(1, 100) <= 25) {
                comportementChoisi = 'elite';
            } else {
                comportementChoisi = Phaser.Math.RND.pick(comportementsPossibles);
            }
            
            enemy.setData('behavior', comportementChoisi);
            enemy.setData('sinOffset', Phaser.Math.Between(0, 5000));
            enemy.setData('hasCharged', false);
            enemy.setData('elapsed', 0);

            // Ajustement physique précis selon le type d'unité
            if (comportementChoisi === 'elite') {
                enemy.setScale(1.4); // Grand format
                enemy.setData('hp', 4); // 4 points de vie
                enemy.setTint(0xfacc15); // Teinte dorée
                
                if (!this.assetsSontVerticaux) {
                    enemy.setAngle(90);
                    enemy.body.setSize(80, 120, true);
                } else {
                    enemy.body.setSize(85, 75, true); // Hitbox du mini-boss
                }
                
                enemy.setVelocityY(50); // Descente très lente et menaçante
            } else {
                enemy.setScale(0.95);
                enemy.setData('hp', 1); // 1 point de vie standard
                
                if (!this.assetsSontVerticaux) {
                    enemy.setAngle(90);
                    enemy.body.setSize(60, 120, true);
                } else {
                    enemy.body.setSize(80, 70, true); // Hitbox standard de enemyBlack1
                }

                let vitesseChute = Phaser.Math.Between(100, 150);
                if (comportementChoisi === 'kamikaze') {
                    vitesseChute = 70;
                }
                enemy.setVelocityY(vitesseChute);
            }
            
            enemy.body.setAllowGravity(false);

            if (this.anims.exists('enemy_fly')) {
                enemy.play('enemy_fly');
            }

            this.creerTraineeReacteurEnnemi(enemy);

            // Cadence de tir
            let cadenceTir = Phaser.Math.Between(1300, 2200); 
            if (comportementChoisi === 'kamikaze') {
                cadenceTir = 99999; // Ne tir pas
            } else if (comportementChoisi === 'elite') {
                cadenceTir = 1100; // Tire fréquemment
            }

            let intervalleTir = this.time.addEvent({
                delay: cadenceTir,
                callback: () => {
                    if (enemy && enemy.active && enemy.y < 720 && !this.partieTerminee) {
                        this.tirerLaserEnnemi(enemy);
                    } else {
                        intervalleTir.destroy();
                    }
                },
                loop: true
            });
        }
    }

    tirerLaserEnnemi(enemy) {
        if (this.partieTerminee || !this.ship || !this.ship.active) return;

        let behavior = enemy.getData('behavior');

        this.jouerSon('laser_enemy'); // Son de laser ennemi

        if (behavior === 'elite') {
            // Tir Élite : Double ou Triple tir vertical
            for (let offset of [-25, 0, 25]) {
                let laser = this.enemyLasers.create(enemy.x + offset, enemy.y + 40, 'enemy_laser');
                if (laser) {
                    if (!this.assetsSontVerticaux) {
                        laser.setAngle(90);
                    }
                    laser.setVelocityY(450);
                    laser.setCollideWorldBounds(false);
                }
            }
        } else {
            // Tir classique vers le bas
            let laser = this.enemyLasers.create(enemy.x, enemy.y + 40, 'enemy_laser');
            if (laser) {
                if (!this.assetsSontVerticaux) {
                    laser.setAngle(90);
                    laser.body.setSize(20, 100, true);
                } else {
                    laser.body.setSize(15, 60, true);
                }
                laser.setVelocityY(550);
                laser.setCollideWorldBounds(false);
            }
        }
    }

    detruireEnnemi(enemy) {
        if (!enemy) return;
        
        let emitter = enemy.getData('emitter');
        if (emitter) {
            emitter.destroy();
        }
        enemy.destroy();
    }

    degatsJoueur(impactX, impactY) {
        if (this.partieTerminee) return;

        // Si le bouclier est actif, il absorbe totalement le choc
        if (this.hasShield) {
            this.creerExplosion(impactX, impactY, 1.5);
            this.cameras.main.flash(100, 56, 189, 248);
            this.hasShield = false; 
            return;
        }

        if (this.estInvulnerable) return;

        this.creerExplosion(impactX, impactY, 2.0);
        this.cameras.main.shake(200, 0.02);

        this.jouerSon('damage'); // Son de dégât

        // Sanction d'armement : Perte d'un niveau d'armement sur impact
        if (this.niveauArme > 1) {
            this.niveauArme--;
            this.mettreAJourTexteArme(this.time.now);
        }

        // Sanction de combo : Le combo tombe immédiatement à zéro
        this.combo = 0;

        this.vies--;
        let coeurs = '❤️'.repeat(Math.max(0, this.vies));
        this.viesText.setText('VIES : ' + (coeurs || '💀'));

        if (this.vies <= 0) {
            this.declencherGameOver();
        } else {
            this.activerInvulnerabilite();
        }
    }

    spawnPowerup(x, y) {
        // Sélection aléatoire parmi les 3 Power-ups : Shield, Arme, Soin
        let typePowerup = Phaser.Math.RND.pick(['shield', 'triple', 'heal']);
        let texture = 'powerup_shield';
        
        if (typePowerup === 'triple') {
            texture = 'powerup_triple';
        } else if (typePowerup === 'heal') {
            texture = 'powerup_heal';
        }

        let powerup = this.powerups.create(x, y, texture);
        if (powerup) {
            powerup.setData('type', typePowerup);
            powerup.setVelocityY(150);
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

        this.jouerSon('explosion'); // Son d'explosion
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
        try {
            this.engineParticles = this.add.particles(0, 0, 'explosion_sheet', {
                frame: 0,
                lifespan: 300,
                speedY: { min: 100, max: 250 }, 
                speedX: { min: -15, max: 15 },
                scale: { start: 0.5, end: 0 },
                blendMode: 'ADD',
                frequency: 25,
                follow: this.ship,
                followOffset: { x: 0, y: this.assetsSontVerticaux ? 45 : 60 }
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
                this.engineParticles.startFollow(this.ship, 0, this.assetsSontVerticaux ? 45 : 60);
            } catch (err) {
                console.warn("Création des particules de réacteur impossible.");
            }
        }
    }

    creerTraineeReacteurEnnemi(enemy) {
        let behavior = enemy.getData('behavior');
        let estElite = behavior === 'elite';
        
        try {
            let emitter = this.add.particles(0, 0, 'explosion_sheet', {
                frame: 0,
                lifespan: estElite ? 350 : 250,
                speedY: { min: -150, max: -80 },
                speedX: { min: -15, max: 15 },
                scale: { start: estElite ? 0.55 : 0.35, end: 0 },
                blendMode: 'ADD',
                frequency: 30,
                follow: enemy,
                followOffset: { x: 0, y: this.assetsSontVerticaux ? -45 : -35 },
                tint: estElite ? [0xeab308, 0xfacc15, 0xfef08a] : [0xec4899, 0xa855f7, 0xf43f5e]
            });
            enemy.setData('emitter', emitter);
        } catch (e) {
            try {
                let particles = this.add.particles('explosion_sheet');
                let emitter = particles.createEmitter({
                    frame: 0,
                    lifespan: 250,
                    speedY: { min: -150, max: -80 },
                    speedX: { min: -15, max: 15 },
                    scale: { start: 0.35, end: 0 },
                    blendMode: 'ADD',
                    frequency: 30,
                    tint: estElite ? 0xeab308 : 0xec4899
                });
                emitter.startFollow(enemy, 0, this.assetsSontVerticaux ? -45 : -35);
                enemy.setData('emitter', emitter);
            } catch (err) {
                console.warn("Impossible de lier la traînée de propulsion à l'ennemi.");
            }
        }
    }

    declencherGameOver() {
        this.partieTerminee = true;

        if (this.generateurAsteroides) this.generateurAsteroides.destroy();
        if (this.generateurEnemies) this.generateurEnemies.destroy();
        if (this.engineParticles) this.engineParticles.destroy();
        
        // Arrêter la musique de fond
        if (this.bgMusic) {
            try {
                this.bgMusic.stop();
            } catch (e) {}
        }

        this.jouerSon('gameover'); // Son de Game Over

        this.ship.setVelocity(0);
        this.ship.alpha = 0.5;

        // Nettoie tous les émetteurs actifs des ennemis
        this.enemies.getChildren().forEach(e => {
            let emitter = e.getData('emitter');
            if (emitter) emitter.destroy();
            e.setVelocity(0);
        });
        
        this.asteroides.getChildren().forEach(a => a.setVelocity(0));
        this.enemyLasers.getChildren().forEach(el => el.setVelocity(0));
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

    // --- SYSTEME DE LECTURE AUDIO ROBUSTE AVEC SYNTHETISEUR DE SECOURS ---
    jouerSon(cle) {
        // CORRECTION : Utilisation de this.cache.audio.exists au lieu de this.sound.exists
        if (this.cache.audio.exists(cle)) {
            try {
                this.sound.play(cle);
                return;
            } catch (e) {
                console.warn("Échec de la lecture du fichier physique: " + cle);
            }
        }

        // Fallback automatique sur le synthétiseur Web Audio si l'asset est absent ou n'a pas pu être décodé
        this.jouerSonSynthetiseur(cle);
    }

    jouerSonSynthetiseur(type) {
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (!AudioContext) return;
            const ctx = new AudioContext();
            
            if (type === 'laser_player') {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.connect(gain);
                gain.connect(ctx.destination);
                
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(800, ctx.currentTime);
                osc.frequency.exponentialRampToValueAtTime(150, ctx.currentTime + 0.15);
                
                gain.gain.setValueAtTime(0.12, ctx.currentTime);
                gain.gain.linearRampToValueAtTime(0.01, ctx.currentTime + 0.15);
                
                osc.start();
                osc.stop(ctx.currentTime + 0.15);
            }
            else if (type === 'laser_enemy') {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.connect(gain);
                gain.connect(ctx.destination);
                
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(450, ctx.currentTime);
                osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.18);
                
                gain.gain.setValueAtTime(0.10, ctx.currentTime);
                gain.gain.linearRampToValueAtTime(0.01, ctx.currentTime + 0.18);
                
                osc.start();
                osc.stop(ctx.currentTime + 0.18);
            }
            else if (type === 'explosion') {
                // Bruit blanc explosif rétro
                const bufferSize = ctx.sampleRate * 0.35;
                const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
                const data = buffer.getChannelData(0);
                for (let i = 0; i < bufferSize; i++) {
                    data[i] = Math.random() * 2 - 1;
                }
                
                const noise = ctx.createBufferSource();
                noise.buffer = buffer;
                
                const filter = ctx.createBiquadFilter();
                filter.type = 'lowpass';
                filter.frequency.setValueAtTime(800, ctx.currentTime);
                filter.frequency.exponentialRampToValueAtTime(20, ctx.currentTime + 0.35);
                
                const gain = ctx.createGain();
                gain.gain.setValueAtTime(0.25, ctx.currentTime);
                gain.gain.linearRampToValueAtTime(0.01, ctx.currentTime + 0.35);
                
                noise.connect(filter);
                filter.connect(gain);
                gain.connect(ctx.destination);
                
                noise.start();
                noise.stop(ctx.currentTime + 0.35);
            }
            else if (type === 'powerup') {
                // Arpège ascendant brillant
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.connect(gain);
                gain.connect(ctx.destination);
                
                osc.type = 'sine';
                const now = ctx.currentTime;
                osc.frequency.setValueAtTime(280, now);
                osc.frequency.setValueAtTime(360, now + 0.05);
                osc.frequency.setValueAtTime(480, now + 0.10);
                osc.frequency.setValueAtTime(620, now + 0.15);
                
                gain.gain.setValueAtTime(0.15, now);
                gain.gain.linearRampToValueAtTime(0.01, now + 0.28);
                
                osc.start();
                osc.stop(now + 0.28);
            }
            else if (type === 'damage') {
                // Son d'impact lourd / alerte de crash
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.connect(gain);
                gain.connect(ctx.destination);
                
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(140, ctx.currentTime);
                osc.frequency.linearRampToValueAtTime(50, ctx.currentTime + 0.25);
                
                gain.gain.setValueAtTime(0.25, ctx.currentTime);
                gain.gain.linearRampToValueAtTime(0.01, ctx.currentTime + 0.25);
                
                osc.start();
                osc.stop(ctx.currentTime + 0.25);
            }
            else if (type === 'dash') {
                // Effet "swoosh" via bruit blanc rapide filtré
                const bufferSize = ctx.sampleRate * 0.15;
                const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
                const data = buffer.getChannelData(0);
                for (let i = 0; i < bufferSize; i++) {
                    data[i] = Math.random() * 2 - 1;
                }
                
                const noise = ctx.createBufferSource();
                noise.buffer = buffer;
                
                const filter = ctx.createBiquadFilter();
                filter.type = 'highpass';
                filter.frequency.setValueAtTime(400, ctx.currentTime);
                filter.frequency.exponentialRampToValueAtTime(1800, ctx.currentTime + 0.15);
                
                const gain = ctx.createGain();
                gain.gain.setValueAtTime(0.18, ctx.currentTime);
                gain.gain.linearRampToValueAtTime(0.01, ctx.currentTime + 0.15);
                
                noise.connect(filter);
                filter.connect(gain);
                gain.connect(ctx.destination);
                
                noise.start();
                noise.stop(ctx.currentTime + 0.15);
            }
            else if (type === 'gameover') {
                // Accord triste descendant
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.connect(gain);
                gain.connect(ctx.destination);
                
                osc.type = 'sawtooth';
                const now = ctx.currentTime;
                osc.frequency.setValueAtTime(180, now);
                osc.frequency.setValueAtTime(140, now + 0.15);
                osc.frequency.setValueAtTime(110, now + 0.3);
                osc.frequency.setValueAtTime(80, now + 0.45);
                
                gain.gain.setValueAtTime(0.2, now);
                gain.gain.linearRampToValueAtTime(0.01, now + 0.75);
                
                osc.start();
                osc.stop(now + 0.75);
            }
        } catch (e) {
            console.warn("Échec de la génération audio procédurale : ", e);
        }
    }

    // --- GESTIONNAIRE DE GRAPHISMES PROCÉDURAUX (FALLBACK ANTI-CRASH AVEC SLICING MULTI-FRAME) ---
    genererTexturesDeSecours() {
        const textureValide = (cle, nbFramesRequis) => {
            if (!this.textures.exists(cle)) return false;
            const tex = this.textures.get(cle);
            if (tex.key === '__MISSING') return false;
            if (nbFramesRequis && tex.frameTotal < (nbFramesRequis + 1)) return false;
            return true;
        };

        // Bouclier
        if (!textureValide('powerup_shield', 1)) {
            if (this.textures.exists('powerup_shield')) this.textures.remove('powerup_shield');
            const canvas = document.createElement('canvas');
            canvas.width = 36; canvas.height = 36;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#0ea5e9'; ctx.beginPath(); ctx.arc(18, 18, 14, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3; ctx.stroke();
            const t = this.textures.addCanvas('powerup_shield', canvas);
            t.add(0, 0, 0, 0, 36, 36);
        }

        // Triple tir
        if (!textureValide('powerup_triple', 1)) {
            if (this.textures.exists('powerup_triple')) this.textures.remove('powerup_triple');
            const canvas = document.createElement('canvas');
            canvas.width = 36; canvas.height = 36;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#f59e0b'; ctx.beginPath(); ctx.arc(18, 18, 14, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3; ctx.stroke();
            const t = this.textures.addCanvas('powerup_triple', canvas);
            t.add(0, 0, 0, 0, 36, 36);
        }

        // Soin
        if (!textureValide('powerup_heal', 1)) {
            if (this.textures.exists('powerup_heal')) this.textures.remove('powerup_heal');
            const canvas = document.createElement('canvas');
            canvas.width = 36; canvas.height = 36;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#ef4444'; ctx.beginPath(); ctx.arc(18, 18, 14, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3; ctx.stroke();
            const t = this.textures.addCanvas('powerup_heal', canvas);
            t.add(0, 0, 0, 0, 36, 36);
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

        // Vaisseau joueur
        if (!textureValide('ship', 3)) {
            if (this.textures.exists('ship')) this.textures.remove('ship');
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
            const t = this.textures.addCanvas('ship', canvas);
            t.add(0, 0, 0, 0, 176, 96);
            t.add(1, 0, 176, 0, 176, 96);
            t.add(2, 0, 352, 0, 176, 96);
        }

        // Vaisseau Ennemi
        if (!textureValide('enemy', 3)) {
            if (this.textures.exists('enemy')) this.textures.remove('enemy');
            const canvas = document.createElement('canvas');
            canvas.width = 96 * 3; canvas.height = 96;
            const ctx = canvas.getContext('2d');
            for (let f = 0; f < 3; f++) {
                const ox = f * 96;
                ctx.fillStyle = f === 0 ? '#ff5500' : '#ffaa00';
                ctx.beginPath(); ctx.moveTo(ox + 10, 48); ctx.lineTo(ox + 30, 35); ctx.lineTo(ox + 30, 61); ctx.closePath(); ctx.fill();
                ctx.fillStyle = '#ec4899'; ctx.beginPath();
                ctx.moveTo(ox + 25, 20); ctx.lineTo(ox + 85, 48); ctx.lineTo(ox + 25, 76); ctx.closePath(); ctx.fill();
                ctx.fillStyle = '#a855f7'; ctx.beginPath();
                ctx.moveTo(ox + 30, 20); ctx.lineTo(ox + 10, 5); ctx.lineTo(ox + 50, 35); ctx.closePath(); ctx.fill();
                ctx.beginPath();
                ctx.moveTo(ox + 30, 76); ctx.lineTo(ox + 10, 91); ctx.lineTo(ox + 50, 61); ctx.closePath(); ctx.fill();
                ctx.fillStyle = '#ef4444'; ctx.beginPath();
                ctx.arc(ox + 60, 48, 8, 0, Math.PI * 2); ctx.fill();
            }
            const t = this.textures.addCanvas('enemy', canvas);
            t.add(0, 0, 0, 0, 96, 96);
            t.add(1, 0, 96, 0, 96, 96);
            t.add(2, 0, 192, 0, 96, 96);
        }

        // Laser Joueur
        if (!textureValide('laser', 1)) {
            if (this.textures.exists('laser')) this.textures.remove('laser');
            const canvas = document.createElement('canvas');
            canvas.width = 170; canvas.height = 90;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#22c55e'; ctx.fillRect(20, 42, 110, 6);
            const t = this.textures.addCanvas('laser', canvas);
            t.add(0, 0, 0, 0, 170, 90);
        }

        // Laser Ennemi
        if (!this.textures.exists('enemy_laser') || this.textures.get('enemy_laser').key === '__MISSING') {
            if (this.textures.exists('enemy_laser')) this.textures.remove('enemy_laser');
            const canvas = document.createElement('canvas');
            canvas.width = 170; canvas.height = 90;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#f43f5e'; ctx.fillRect(20, 42, 110, 6);
            const t = this.textures.addCanvas('enemy_laser', canvas);
            t.add(0, 0, 0, 0, 170, 90);
        }

        // Astéroïdes
        if (!textureValide('asteroide_sheet', 19)) {
            if (this.textures.exists('asteroide_sheet')) this.textures.remove('asteroide_sheet');
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
            const t = this.textures.addCanvas('asteroide_sheet', canvas);
            for (let i = 0; i < 19; i++) {
                t.add(i, 0, i * 70, 0, 70, 70);
            }
        }

        // Explosion
        if (!textureValide('explosion_sheet', 12)) {
            if (this.textures.exists('explosion_sheet')) this.textures.remove('explosion_sheet');
            const canvas = document.createElement('canvas');
            canvas.width = 96 * 12; canvas.height = 96;
            const ctx = canvas.getContext('2d');
            for (let i = 0; i < 12; i++) {
                const ox = i * 96;
                ctx.fillStyle = `rgba(239, 68, 68, ${1 - i / 12})`;
                ctx.beginPath(); ctx.arc(ox + 48, 48, 10 + i * 3, 0, Math.PI * 2); ctx.fill();
                ctx.fillStyle = `rgba(251, 146, 60, ${1 - i / 12})`;
                ctx.beginPath(); ctx.arc(ox + 48, 48, 5 + i * 2, 0, Math.PI * 2); ctx.fill();
            }
            const t = this.textures.addCanvas('explosion_sheet', canvas);
            for (let i = 0; i < 12; i++) {
                t.add(i, 0, i * 96, 0, 96, 96);
            }
        }
    }
}