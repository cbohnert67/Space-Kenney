export class Start extends Phaser.Scene {

    constructor() {
        super('Start');
    }

    preload() {
        // Chargement des images et spritesheets depuis tes dossiers locaux
        this.load.image('background', 'assets/background/darkPurple.png');
        this.load.spritesheet('ship', 'assets/PNG/playerShip1_red.png', { frameWidth: 99, frameHeight: 75 });
        this.load.spritesheet('laser', 'assets/PNG/Lasers/laserGreen02.png', { frameWidth: 13, frameHeight: 57 });
        
        
        // Nouveaux assets pour l'ennemi et ses lasers
        this.load.spritesheet('enemy', 'assets/PNG/Enemies/enemyBlack1.png', { frameWidth: 93, frameHeight: 84 });
        this.load.image('enemy_laser', 'assets/PNG/Lasers/laserRed01.png');

        // Préchargement des nouveaux bonus locaux (Power-ups) avec vos fichiers d'images
        this.load.image('powerup_shield', 'assets/PNG/Power-ups/powerupRed_shield.png');
        this.load.image('powerup_triple', 'assets/PNG/Power-ups/powerupRed_bolt.png');

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
        // Si tes propres fichiers locaux de vaisseau/lasers/ennemis sont dessinés horizontalement (pointant vers la droite),
        // laisse cette variable à "false". Phaser les pivotera automatiquement de -90° vers le haut (ou 90° vers le bas pour les ennemis).
        // Si tes nouveaux assets pointent déjà nativement vers le haut/bas, passe-la à "true".
        this.assetsSontVerticaux = true;

        // GÉNÉRATEUR AUTOMATIQUE DE TEXTURES DE SECOURS (Anti-Crash & Slicing correct)
        //this.genererTexturesDeSecours();

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
        this.enemies = this.physics.add.group();
        this.enemyLasers = this.physics.add.group();
        this.powerups = this.physics.add.group();

        // --- CRÉATION ET CONFIGURATION DES ANIMATIONS ---
        
        // Vol du joueur
        this.ship.anims.create({
            key: 'fly',
            frames: this.anims.generateFrameNumbers('ship', { start: 0, end: 2 }),
            frameRate: 15,
            repeat: -1
        });
        this.ship.play('fly');

        // Vol de l'ennemi
        this.anims.create({
            key: 'enemy_fly',
            frames: this.anims.generateFrameNumbers('enemy', { start: 0, end: 2 }),
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

        // Animation de l'explosion (12 frames)
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

        // --- BOUCLES D'ÉVÉNEMENTS (GÉNÉRATEURS D'OBSTACLES ET D'ENNEMIS) ---
        this.generateurAsteroides = this.time.addEvent({
            delay: 1500,
            callback: this.spawnAsteroide,
            callbackScope: this,
            loop: true
        });

        this.generateurEnemies = this.time.addEvent({
            delay: 3000, // Apparition d'un vaisseau ennemi toutes les 3 secondes
            callback: this.spawnEnemy,
            callbackScope: this,
            loop: true
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

                        let vx = i === 0 ? -120 : 120;
                        let vy = Phaser.Math.Between(320, 480);
                        depris.setVelocity(vx, vy);
                        depris.body.setAllowGravity(false);
                    }
                }
            } else {
                this.creerExplosion(impactX, impactY, 1.3);
                this.score += 10;
            }

            this.scoreText.setText('SCORE : ' + String(this.score).padStart(4, '0'));

            if (Phaser.Math.RND.between(1, 100) <= 15) {
                this.spawnPowerup(impactX, impactY);
            }
        });

        // 2. Collision Laser Joueur 💥 Vaisseau Ennemi
        this.physics.add.overlap(this.lasers, this.enemies, (laser, enemy) => {
            const impactX = enemy.x;
            const impactY = enemy.y;

            laser.destroy();
            this.detruireEnnemi(enemy); 

            this.creerExplosion(impactX, impactY, 2.0);
            this.score += 50; 
            this.scoreText.setText('SCORE : ' + String(this.score).padStart(4, '0'));

            if (Phaser.Math.RND.between(1, 100) <= 25) {
                this.spawnPowerup(impactX, impactY);
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

        // 6. Collision Joueur 💥 Power-up
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

        // --- DÉPLACEMENTS DU VAISSEAU JOUEUR ---
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

        // --- INTELLIGENCE ARTIFICIELLE & MOUVEMENTS ENNEMIS ---
        this.enemies.getChildren().forEach(enemy => {
            if (!enemy || !enemy.active) return;

            let behavior = enemy.getData('behavior');

            if (behavior === 'tracker') {
                // Comportement Traqueur : S'aligne continuellement sur l'axe X du joueur de manière réactive
                let diffX = this.ship.x - enemy.x;
                enemy.setVelocityX(diffX * 2.5); // Vitesse de correction adaptative
            } 
            else if (behavior === 'sine') {
                // Comportement Sinusoïdal : effectue des zigzags en vagues élégantes
                let phaseOffset = enemy.getData('sinOffset');
                enemy.setVelocityX(Math.sin((time + phaseOffset) / 250) * 300);
            } 
            else if (behavior === 'kamikaze') {
                // Comportement Kamikaze : descend lentement, puis fonce en piqué sur le joueur si détecté
                let distance = Phaser.Math.Distance.Between(enemy.x, enemy.y, this.ship.x, this.ship.y);
                if (distance < 420 && !enemy.getData('hasCharged')) {
                    enemy.setData('hasCharged', true);
                    
                    // Calcul de l'angle d'impact direct
                    let angleCharge = Phaser.Math.Angle.Between(enemy.x, enemy.y, this.ship.x, this.ship.y);
                    
                    // Accélération physique massive initiale
                    this.physics.velocityFromRotation(angleCharge, 650, enemy.body.velocity);
                }

                // Ajustement dynamique de l'orientation et de la trajectoire une fois la charge lancée
                if (enemy.getData('hasCharged')) {
                    let currentAngle = Math.atan2(enemy.body.velocity.y, enemy.body.velocity.x);
                    
                    // CORRECTION DE L'ORIENTATION : Ajustement mathématique selon le type d'asset (horizontal/vertical)
                    if (!this.assetsSontVerticaux) {
                        enemy.setRotation(currentAngle);
                    } else {
                        enemy.setRotation(currentAngle - Math.PI / 2);
                    }
                    
                    // Courbe de poursuite fluide de type "tête chercheuse" vers le joueur
                    let angleToPlayer = Phaser.Math.Angle.Between(enemy.x, enemy.y, this.ship.x, this.ship.y);
                    let newAngle = Phaser.Math.Angle.RotateTo(currentAngle, angleToPlayer, 0.04); 
                    this.physics.velocityFromRotation(newAngle, 650, enemy.body.velocity);
                }
            }
            else if (behavior === 'looping') {
                // Comportement Looping : effectue des boucles/spirales fluides tout en descendant
                let elapsed = enemy.getData('elapsed') + delta;
                enemy.setData('elapsed', elapsed);

                let t = elapsed / 1000; // Conversion en secondes
                let omega = 5; // Vitesse de rotation du looping (rad/s)
                let radius = 110; // Rayon de la boucle
                let driftSpeed = 130; // Vitesse de descente générale de l'écran

                // Calcul mathématique des vitesses circulaires combinées à la dérive verticale
                let vx = -radius * omega * Math.sin(omega * t);
                let vy = driftSpeed + radius * omega * Math.cos(omega * t);

                enemy.setVelocity(vx, vy);

                // Ajustement d'orientation fluide basé sur son vecteur de vitesse instantané
                let currentAngle = Math.atan2(vy, vx);
                if (!this.assetsSontVerticaux) {
                    enemy.setRotation(currentAngle);
                } else {
                    enemy.setRotation(currentAngle - Math.PI / 2);
                }
            }
        });

        // --- SYSTÈME DE TIR DU JOUEUR (VERS LE HAUT) ---
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

        // Supprimer les tirs joueurs qui sortent par le haut de l'écran
        this.lasers.getChildren().forEach(l => {
            if (l.y < -100 || l.x < -100 || l.x > 1380) objetsADetruire.push(l);
        });

        // Supprimer les tirs ennemis qui sortent par le bas de l'écran
        this.enemyLasers.getChildren().forEach(el => {
            if (el.y > 820 || el.x < -100 || el.x > 1380) objetsADetruire.push(el);
        });

        // Supprimer les astéroïdes qui dépassent le bas de l'écran
        this.asteroides.getChildren().forEach(a => {
            if (a.y > 820) objetsADetruire.push(a);
        });

        // Supprimer les ennemis qui dépassent le bas de l'écran
        this.enemies.getChildren().forEach(e => {
            if (e.y > 820) {
                objetsADetruire.push(e);
            }
        });

        // Supprimer les bonus qui dépassent le bas de l'écran
        this.powerups.getChildren().forEach(p => {
            if (p.y > 820) objetsADetruire.push(p);
        });

        // Exécution sécurisée des destructions d'ennemis et de leurs émetteurs associés
        objetsADetruire.forEach(obj => {
            if (this.enemies.contains(obj)) {
                this.detruireEnnemi(obj);
            } else {
                obj.destroy();
            }
        });
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

    spawnEnemy() {
        if (this.partieTerminee) return;

        // Génération d'un vaisseau ennemi en haut à une abscisse aléatoire
        let xAleatoire = Phaser.Math.Between(150, 1130); // Réduit un peu les bords pour les loopings
        let enemy = this.enemies.create(xAleatoire, -80, 'enemy');

        if (enemy) {
            enemy.setScale(0.95);

            // Sélection aléatoire d'un profil d'intelligence artificielle (Intégration du comportement 'looping')
            let comportementsPossibles = ['tracker', 'sine', 'kamikaze', 'looping'];
            let comportementChoisi = Phaser.Math.RND.pick(comportementsPossibles);
            
            enemy.setData('behavior', comportementChoisi);
            enemy.setData('sinOffset', Phaser.Math.Between(0, 5000)); // Décalage pour le zigzag
            enemy.setData('hasCharged', false); // Indicateur de charge kamikaze
            enemy.setData('elapsed', 0); // Temps accumulé pour les calculs de looping

            // Ajustement de la hitbox et de l'orientation initiale
            if (!this.assetsSontVerticaux) {
                enemy.setAngle(90); // Oriente le sprite horizontal vers le bas
                enemy.body.setSize(60, 120, true);
            } else {
                enemy.body.setSize(120, 60, true);
            }

            // Vitesse de base modérée vers le bas
            let vitesseChute = Phaser.Math.Between(100, 150);
            if (comportementChoisi === 'kamikaze') {
                vitesseChute = 70; // Les kamikazes planent calmement en haut avant d'attaquer
            }
            enemy.setVelocityY(vitesseChute);
            enemy.body.setAllowGravity(false);

            // Lancer l'animation de vol de l'ennemi s'il y en a une
            if (this.anims.exists('enemy_fly')) {
                enemy.play('enemy_fly');
            }

            // CRÉER LA TRAÎNÉE DE RÉACTEUR ENNEMIE NÉON
            this.creerTraineeReacteurEnnemi(enemy);

            // Gestion de l'IA de tir ciblé
            let cadenceTir = Phaser.Math.Between(1300, 2200); 
            if (comportementChoisi === 'kamikaze') {
                cadenceTir = 99999; // Les kamikazes ne tirent pas, ils chargent !
            }

            let intervalleTir = this.time.addEvent({
                delay: cadenceTir,
                callback: () => {
                    // Ne tire que si l'ennemi est toujours actif et à l'écran
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

        // Crée un laser ennemi à sa position
        let laser = this.enemyLasers.create(enemy.x, enemy.y + 50, 'enemy_laser');
        if (laser) {
            // CORRECTION : Les ennemis tirent désormais UNIQUEMENT verticalement vers le bas
            if (!this.assetsSontVerticaux) {
                laser.setAngle(90); // Oriente l'asset horizontal vers le bas
                laser.body.setSize(20, 100, true);
            } else {
                laser.body.setSize(100, 20, true);
            }
            
            // Propulsion verticale constante vers le bas
            laser.setVelocityY(550);
            laser.setVelocityX(0); // Pas de visée angulaire sur les côtés
            laser.setCollideWorldBounds(false);
        }
    }

    detruireEnnemi(enemy) {
        if (!enemy) return;
        
        // Extrait et détruit l'émetteur de particules associé pour éviter les fuites de mémoire
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
            this.cameras.main.flash(100, 56, 189, 248); // Flash cyan protecteur
            this.hasShield = false; // Le bouclier se brise après un coup
            return;
        }

        // Ignorer les dégâts durant l'invulnérabilité
        if (this.estInvulnerable) return;

        // Effets visuels de l'impact
        this.creerExplosion(impactX, impactY, 2.0);
        this.cameras.main.shake(200, 0.02); // Secousse de caméra

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

    creerTraineeReacteurEnnemi(enemy) {
        // Propulsion vers le haut (Y négatif) puisque l'ennemi se déplace vers le bas
        try {
            let emitter = this.add.particles(0, 0, 'explosion_sheet', {
                frame: 0,
                lifespan: 250,
                speedY: { min: -150, max: -80 },
                speedX: { min: -15, max: 15 },
                scale: { start: 0.35, end: 0 },
                blendMode: 'ADD',
                frequency: 30,
                follow: enemy,
                followOffset: { x: 0, y: this.assetsSontVerticaux ? -50 : -35 },
                tint: [0xec4899, 0xa855f7, 0xf43f5e] // Dégradé de couleurs néon roses/violettes ennemies
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
                    tint: 0xec4899
                });
                emitter.startFollow(enemy, 0, this.assetsSontVerticaux ? -50 : -35);
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
        
        this.ship.setVelocity(0);
        this.ship.alpha = 0.5;

        // Nettoie tous les émetteurs actifs des ennemis restants pour un game over propre
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

        // Fond étoilé (Image simple)
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

        // Vaisseau joueur (Spritesheet - 3 frames de 176x96)
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

        // Vaisseau Ennemi (Spritesheet - 3 frames de 96x96)
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

        // Laser Joueur (Spritesheet - 1 frame de 170x90)
        if (!textureValide('laser', 1)) {
            if (this.textures.exists('laser')) this.textures.remove('laser');
            const canvas = document.createElement('canvas');
            canvas.width = 170; canvas.height = 90;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#22c55e'; ctx.fillRect(20, 42, 110, 6);
            const t = this.textures.addCanvas('laser', canvas);
            t.add(0, 0, 0, 0, 170, 90);
        }

        // Laser Ennemi (Image simple ou 1 frame de 170x90)
        if (!this.textures.exists('enemy_laser') || this.textures.get('enemy_laser').key === '__MISSING') {
            if (this.textures.exists('enemy_laser')) this.textures.remove('enemy_laser');
            const canvas = document.createElement('canvas');
            canvas.width = 170; canvas.height = 90;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#f43f5e'; ctx.fillRect(20, 42, 110, 6);
            const t = this.textures.addCanvas('enemy_laser', canvas);
            t.add(0, 0, 0, 0, 170, 90);
        }

        // Astéroïdes (Spritesheet - 19 frames de 70x70)
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

        // Explosion (Spritesheet - 12 frames de 96x96)
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