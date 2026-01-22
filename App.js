import React, { useEffect, useState } from "react";
import {
    View, Text, StyleSheet, Dimensions, TouchableOpacity,
    TextInput, FlatList, StatusBar, SafeAreaView, Vibration, Modal, Alert
} from "react-native";
import AsyncStorage from '@react-native-async-storage/async-storage';

// Firebase Imports
import { initializeApp, getApps, getApp } from "firebase/app";
import { 
    getFirestore, collection, addDoc, query, 
    orderBy, limit, onSnapshot, serverTimestamp,
    getAggregateFromServer, sum, doc, deleteDoc 
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBmoceXlcX5rj3rl5Vihz5C5Gnn6HEJE-w",
  authDomain: "rocketblaza.firebaseapp.com",
  projectId: "rocketblaza",
  storageBucket: "rocketblaza.firebasestorage.app",
  messagingSenderId: "212260223073",
  appId: "1:212260223073:web:11b5188cac2386e0cbd220"
};

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const db = getFirestore(app);

const { width, height } = Dimensions.get("window");
const PLAYER_WIDTH = 45;
const PLAYER_HEIGHT = 75;
const OBSTACLE_SIZE = 48;
const SHIELD_SIZE = 40;
const GAME_HEIGHT = height * 0.62;

const createObstacle = (speedMultiplier) => ({
    id: Math.random().toString(),
    x: Math.random() * (width - OBSTACLE_SIZE),
    y: -Math.random() * 800 - OBSTACLE_SIZE,
    speed: (Math.random() * 3 + 5) * speedMultiplier,
});

export default function App() {
    const [screen, setScreen] = useState("LOGIN");
    const [username, setUsername] = useState("");
    const [globalScores, setGlobalScores] = useState([]);
    const [totalMeters, setTotalMeters] = useState(0);
    const [pilotOfTheDay, setPilotOfTheDay] = useState(null);
    const [difficulty, setDifficulty] = useState(null);
    const [playerX, setPlayerX] = useState(width / 2 - PLAYER_WIDTH / 2);
    const [obstacles, setObstacles] = useState([]);
    const [score, setScore] = useState(0);
    const [personalBest, setPersonalBest] = useState(0);
    const [gameOver, setGameOver] = useState(false);
    const [isExploding, setIsExploding] = useState(false);
    const [isOnline, setIsOnline] = useState(false);
    const [shield, setShield] = useState(null); 
    const [hasShield, setHasShield] = useState(false);

    const [adminVisible, setAdminVisible] = useState(false);
    const [adminTapCount, setAdminTapCount] = useState(0);
    const [fullDatabase, setFullDatabase] = useState([]);
    const [searchQuery, setSearchQuery] = useState("");

    useEffect(() => {
        const loadHighscore = async () => {
            const saved = await AsyncStorage.getItem('pBest');
            if (saved) setPersonalBest(parseInt(saved));
        };
        loadHighscore();
    }, []);

    useEffect(() => {
        const q = query(collection(db, "leaderboard"), orderBy("score", "desc"), limit(200));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setIsOnline(true);
            const allData = [];
            snapshot.forEach((doc) => {
                const data = doc.data();
                allData.push({ name: String(data.name), score: Number(data.score), id: doc.id });
            });
            // FILTER: Remove Daily Bonus from the core data list
            const realPilotsOnly = allData.filter(p => p.name !== "🎁 DAILY BONUS");
            setFullDatabase(realPilotsOnly);
            setGlobalScores(realPilotsOnly.slice(0, 20));
            if (realPilotsOnly.length > 0) setPilotOfTheDay(realPilotsOnly[0]);
            updateGlobalTotal();
        }, () => setIsOnline(false));
        return () => unsubscribe();
    }, []);

    const updateGlobalTotal = async () => {
        try {
            const coll = collection(db, "leaderboard");
            const snapshot = await getAggregateFromServer(coll, { total: sum('score') });
            setTotalMeters(snapshot.data().total || 0);
        } catch (e) { setIsOnline(false); }
    };

    const handleAdminTap = () => {
        setAdminTapCount(prev => {
            if (prev + 1 >= 5) {
                setAdminVisible(true);
                return 0;
            }
            return prev + 1;
        });
    };

    const deletePlayer = (id, name) => {
        Alert.alert("ERASE DATA", `Permanently remove ${name}?`, [
            { text: "Cancel" },
            { text: "DELETE", style: 'destructive', onPress: async () => {
                await deleteDoc(doc(db, "leaderboard", id));
            }}
        ]);
    };

    const filteredDatabase = fullDatabase.filter(item => 
        item.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // --- GAME ENGINE ---
    useEffect(() => {
        if (gameOver || isExploding || screen !== "GAME" || !difficulty) return;
        const interval = setInterval(() => {
            setObstacles((prev) => prev.map(obs => {
                let newY = obs.y + obs.speed;
                if (newY > GAME_HEIGHT) {
                    setScore(s => {
                        const newS = s + 1;
                        if (newS > personalBest) setPersonalBest(newS);
                        if (newS % 50 === 0 && !shield && !hasShield) {
                            setShield({ x: Math.random() * (width - SHIELD_SIZE), y: -50, speed: 4 });
                        }
                        return newS;
                    });
                    return createObstacle(difficulty.speedMultiplier);
                }
                if (newY + OBSTACLE_SIZE > GAME_HEIGHT - PLAYER_HEIGHT && 
                    obs.x < playerX + PLAYER_WIDTH - 10 && obs.x + OBSTACLE_SIZE > playerX + 10) {
                    if (hasShield) {
                        setHasShield(false);
                        return createObstacle(difficulty.speedMultiplier);
                    } else {
                        setIsExploding(true);
                        Vibration.vibrate(500);
                        setTimeout(() => setGameOver(true), 800);
                    }
                }
                return { ...obs, y: newY };
            }));

            if (shield) {
                setShield(prev => {
                    if (!prev) return null;
                    const newY = prev.y + prev.speed;
                    if (newY + SHIELD_SIZE > GAME_HEIGHT - PLAYER_HEIGHT && 
                        prev.x < playerX + PLAYER_WIDTH && prev.x + SHIELD_SIZE > playerX) {
                        setHasShield(true);
                        setTimeout(() => setHasShield(false), 5000);
                        return null;
                    }
                    return newY > GAME_HEIGHT ? null : { ...prev, y: newY };
                });
            }
        }, 16); 
        return () => clearInterval(interval);
    }, [gameOver, isExploding, screen, playerX, difficulty, personalBest, shield, hasShield]);

    useEffect(() => {
        if (gameOver && score > 0) {
            addDoc(collection(db, "leaderboard"), {
                name: String(username) || "Pilot",
                score: Number(score),
                createdAt: serverTimestamp()
            });
            AsyncStorage.setItem('pBest', personalBest.toString());
        }
    }, [gameOver]);

    const startMission = (mode) => {
        const configs = {
            EASY: { label: 'MARS', speedMultiplier: 1.0, count: 5, color: '#4CAF50', bg: '#1A0A0A' },
            NORMAL: { label: 'JUPITER', speedMultiplier: 1.5, count: 7, color: '#00E5FF', bg: '#0A0E1A' },
            HARD: { label: 'VOID', speedMultiplier: 2.2, count: 10, color: '#D500F9', bg: '#05000A' }
        };
        const config = configs[mode];
        setDifficulty(config);
        setScore(0);
        setHasShield(false);
        setShield(null);
        setObstacles(Array.from({ length: config.count }, () => createObstacle(config.speedMultiplier)));
        setGameOver(false);
        setIsExploding(false);
        setScreen("GAME");
    };

    if (screen === "LOGIN") return (
        <View style={ui.container}>
            <TouchableOpacity activeOpacity={1} onPress={handleAdminTap} style={{alignItems: 'center'}}>
                <Text style={ui.logo}>ROCKET{"\n"}BLAZA</Text>
            </TouchableOpacity>
            <View style={ui.glassInputContainer}>
                <TextInput placeholder="PILOT NAME" placeholderTextColor="#555" style={ui.input} onChangeText={setUsername} />
            </View>
            <TouchableOpacity style={ui.glowBtn} onPress={() => { if(!username) return; setScreen("MENU"); }}>
                <Text style={ui.btnText}>LAUNCH</Text>
            </TouchableOpacity>

            <Modal visible={adminVisible} animationType="slide">
                <SafeAreaView style={[ui.container, {backgroundColor: '#000'}]}>
                    <View style={ui.adminHeader}>
                        <Text style={ui.adminTitle}>CORE DATABASE</Text>
                        <Text style={ui.adminSubTitle}>{fullDatabase.length} PILOTS DETECTED</Text>
                        <TextInput 
                            placeholder="Find Pilot..." 
                            placeholderTextColor="#444" 
                            style={ui.adminSearch} 
                            onChangeText={setSearchQuery} 
                        />
                    </View>
                    <FlatList 
                        style={{width: '95%'}}
                        contentContainerStyle={{paddingBottom: 20}}
                        data={filteredDatabase}
                        renderItem={({item}) => (
                            <View style={ui.adminRow}>
                                <View style={{flex: 1}}>
                                    <Text style={ui.adminNameText}>{item.name}</Text>
                                    <Text style={ui.adminScoreText}>{item.score}m</Text>
                                </View>
                                <TouchableOpacity onPress={() => deletePlayer(item.id, item.name)} style={ui.adminDelBtn}>
                                    <Text style={{color: '#FFF', fontSize: 11, fontWeight: 'bold'}}>BAN</Text>
                                </TouchableOpacity>
                            </View>
                        )}
                    />
                    <TouchableOpacity style={[ui.glowBtn, {backgroundColor: '#222', width: '90%', marginBottom: 20}]} onPress={() => setAdminVisible(false)}>
                        <Text style={{color: '#FFF', textAlign: 'center'}}>CLOSE TERMINAL</Text>
                    </TouchableOpacity>
                </SafeAreaView>
            </Modal>
        </View>
    );

    if (screen === "MENU") return (
        <SafeAreaView style={ui.container}>
            <View style={ui.statusBadge}>
                <View style={[ui.statusDot, {backgroundColor: isOnline ? '#4CAF50' : '#F44336'}]} />
                <Text style={ui.statusTxt}>{isOnline ? 'SYSTEM ONLINE' : 'OFFLINE MODE'}</Text>
            </View>
            <Text style={ui.menuTitle}>COMMAND CENTRE</Text>
            <View style={ui.statBox}><Text style={ui.statLabel}>GLOBAL DISTANCE</Text><Text style={ui.statVal}>{totalMeters.toLocaleString()}m</Text></View>
            {pilotOfTheDay && (
                <View style={ui.aceCard}>
                    <Text style={ui.aceLabel}>👑 CURRENT ACE</Text>
                    <Text style={ui.aceName}>{String(pilotOfTheDay.name)} — {pilotOfTheDay.score}m</Text>
                </View>
            )}
            <TouchableOpacity style={ui.glowBtn} onPress={() => setScreen("DIFFICULTY")}><Text style={ui.btnText}>NEW MISSION</Text></TouchableOpacity>
            <TouchableOpacity style={ui.secondaryBtn} onPress={() => setScreen("LEADERBOARD")}><Text style={ui.secondaryBtnTxt}>LEADERBOARD</Text></TouchableOpacity>
            
            <TouchableOpacity style={ui.logoutBtn} onPress={() => setScreen("LOGIN")}>
                <Text style={ui.logoutTxt}>LOGOUT TO USERNAME</Text>
            </TouchableOpacity>
        </SafeAreaView>
    );

    if (screen === "LEADERBOARD") return (
        <SafeAreaView style={ui.container}>
            <Text style={[ui.menuTitle, {marginTop: 40}]}>TOP PILOTS</Text>
            <FlatList style={{width: '90%', marginTop: 20}} data={globalScores} keyExtractor={item => item.id} renderItem={({item, index}) => (
                <View style={ui.rankRow}>
                    <Text style={ui.rankNum}>#{index+1}</Text>
                    <Text style={ui.rankName}>{String(item.name)}</Text>
                    <Text style={ui.rankScore}>{item.score}m</Text>
                </View>
            )} />
            <TouchableOpacity style={[ui.glowBtn, {marginBottom: 30}]} onPress={() => setScreen("MENU")}><Text style={ui.btnText}>BACK</Text></TouchableOpacity>
        </SafeAreaView>
    );

    if (screen === "DIFFICULTY") return (
        <View style={ui.container}>
            <Text style={ui.menuTitle}>SELECT SECTOR</Text>
            <View style={{width: '85%', marginTop: 30}}>
                {['EASY', 'NORMAL', 'HARD'].map(m => (
                    <TouchableOpacity key={m} style={[ui.sectorCard, {borderColor: m==='EASY'?'#4CAF50':m==='NORMAL'?'#00E5FF':'#D500F9'}]} onPress={() => startMission(m)}>
                        <Text style={[ui.sectorText, {color: m==='EASY'?'#4CAF50':m==='NORMAL'?'#00E5FF':'#D500F9'}]}>{m} SECTOR</Text>
                    </TouchableOpacity>
                ))}
            </View>
            <TouchableOpacity style={{marginTop: 30}} onPress={() => setScreen("MENU")}><Text style={{color: '#666'}}>BACK</Text></TouchableOpacity>
        </View>
    );

    return (
        <View style={[game.container, {backgroundColor: difficulty?.bg || '#000'}]}>
            <StatusBar hidden />
            <View style={game.header}>
                <TouchableOpacity onPress={() => setScreen("MENU")}><Text style={{color: '#666'}}>EXIT</Text></TouchableOpacity>
                <View style={{alignItems: 'center'}}>
                    <Text style={game.scoreVal}>{score}m</Text>
                    <Text style={game.bestVal}>BEST: {personalBest}m</Text>
                </View>
                <Text style={{color: difficulty?.color, fontWeight: 'bold'}}>{String(difficulty?.label)}</Text>
            </View>
            <View style={game.area}>
                {shield && (<View style={[game.shieldItem, { top: shield.y, left: shield.x }]}><Text style={{fontSize: 30}}>🛡️</Text></View>)}
                {obstacles.map(obs => (<View key={obs.id} style={[game.obstacle, { top: obs.y, left: obs.x }]}><Text style={{fontSize: 40}}>☄️</Text></View>))}
                <View style={[game.rocket, { left: playerX, top: GAME_HEIGHT - PLAYER_HEIGHT, opacity: isExploding ? 0.3 : 1 }]}>
                    {hasShield && <View style={game.shieldAura} />}
                    <View style={[game.rTip, {borderBottomColor: hasShield ? '#00E5FF' : (isExploding ? 'red' : (difficulty?.color || '#FFF'))}]} />
                    <View style={[game.rBody, hasShield && {backgroundColor: '#B2EBF2'}]}>
                        <View style={game.rWindow} /><View style={game.finLeft} /><View style={game.finRight} />
                    </View>
                    {!gameOver && !isExploding && (<View style={[game.rFlame, {backgroundColor: difficulty?.color || '#FF9500'}]}><View style={game.innerFlame} /></View>)}
                </View>
                {gameOver && (
                    <View style={game.modal}>
                        <Text style={ui.logoSmall}>MISSION FAILED</Text>
                        <Text style={{color: '#FFF', marginBottom: 20}}>Distance: {score}m</Text>
                        <TouchableOpacity style={ui.glowBtn} onPress={() => startMission(difficulty.label === 'MARS' ? 'EASY' : (difficulty.label === 'JUPITER' ? 'NORMAL' : 'HARD'))}><Text style={ui.btnText}>RESTART</Text></TouchableOpacity>
                        <TouchableOpacity style={{marginTop: 20}} onPress={() => setScreen("MENU")}><Text style={{color: '#FFF'}}>EXIT TO MENU</Text></TouchableOpacity>
                    </View>
                )}
            </View>
            <View style={game.controls}>
                <TouchableOpacity style={game.ctrl} onPressIn={() => setPlayerX(x => Math.max(0, x - 65))}><Text style={game.ctrlTxt}>◀</Text></TouchableOpacity>
                <TouchableOpacity style={game.ctrl} onPressIn={() => setPlayerX(x => Math.min(width - PLAYER_WIDTH, x + 65))}><Text style={game.ctrlTxt}>▶</Text></TouchableOpacity>
            </View>
        </View>
    );
}

const ui = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#020105", alignItems: "center", justifyContent: "center" },
    logo: { fontSize: 48, fontWeight: "900", color: "#00E5FF", textAlign: "center", marginBottom: 40, letterSpacing: 5 },
    logoSmall: { fontSize: 28, color: "#FF4D6D", marginBottom: 5, fontWeight: 'bold' },
    glassInputContainer: { width: '80%', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 15, borderWidth: 1, borderColor: '#333', marginBottom: 20 },
    input: { padding: 15, color: "#FFF", textAlign: 'center' },
    glowBtn: { backgroundColor: "#00E5FF", paddingVertical: 15, paddingHorizontal: 40, borderRadius: 10 },
    btnText: { color: "#000", fontWeight: "bold" },
    menuTitle: { color: "#FFF", fontSize: 20, fontWeight: "bold", letterSpacing: 2 },
    statusBadge: { flexDirection: 'row', alignItems: 'center', position: 'absolute', top: 50, backgroundColor: 'rgba(255,255,255,0.05)', padding: 8, borderRadius: 20 },
    statusDot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
    statusTxt: { color: '#666', fontSize: 10 },
    statBox: { backgroundColor: '#0A0A0F', padding: 20, borderRadius: 15, width: '90%', marginVertical: 20, alignItems: 'center', borderWidth: 1, borderColor: '#222' },
    statVal: { color: '#FFF', fontSize: 24, fontWeight: 'bold' },
    statLabel: { color: '#666', fontSize: 10 },
    aceCard: { width: '90%', padding: 20, borderRadius: 15, borderWidth: 1, borderColor: '#00E5FF', marginBottom: 20 },
    aceName: { color: '#FFF', fontSize: 18, textAlign: 'center', fontWeight: 'bold' },
    aceLabel: { color: '#00E5FF', fontSize: 10, textAlign: 'center', marginBottom: 5 },
    secondaryBtn: { marginTop: 15 },
    secondaryBtnTxt: { color: '#666' },
    logoutBtn: { marginTop: 40 },
    logoutTxt: { color: '#444', fontWeight: 'bold', fontSize: 12 },
    rankRow: { flexDirection: 'row', padding: 15, backgroundColor: '#0A0A0F', marginBottom: 10, borderRadius: 10, width: '100%' },
    rankNum: { color: '#00E5FF', width: 30 },
    rankName: { color: '#FFF', flex: 1 },
    rankScore: { color: '#FFF' },
    sectorCard: { padding: 20, borderRadius: 15, borderWidth: 1, marginBottom: 15, width: '100%', alignItems: 'center' },
    sectorText: { fontWeight: 'bold' },
    adminHeader: { width: '100%', alignItems: 'center', paddingTop: 60, paddingBottom: 20, borderBottomWidth: 1, borderBottomColor: '#1A1A1A', marginBottom: 10 },
    adminTitle: { color: '#FF3D00', fontSize: 24, fontWeight: '900', letterSpacing: 4, textAlign: 'center' },
    adminSubTitle: { color: '#666', fontSize: 11, marginTop: 5, fontWeight: 'bold' },
    adminSearch: { width: '85%', backgroundColor: '#111', color: '#FFF', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#333', marginTop: 20, textAlign: 'center' },
    adminRow: { flexDirection: 'row', padding: 15, backgroundColor: '#0A0A0F', marginBottom: 8, borderRadius: 12, alignItems: 'center' },
    adminNameText: { color: '#FFF', fontWeight: 'bold', fontSize: 16 },
    adminScoreText: { color: '#666', fontSize: 12 },
    adminDelBtn: { backgroundColor: '#FF3D00', paddingVertical: 10, paddingHorizontal: 15, borderRadius: 8 }
});

const game = StyleSheet.create({
    container: { flex: 1 },
    header: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 30, paddingTop: 50, alignItems: 'center' },
    scoreVal: { color: '#FFF', fontSize: 35, fontWeight: 'bold' },
    bestVal: { color: '#00E5FF', fontSize: 12, fontWeight: 'bold', marginTop: -5 },
    area: { width, height: GAME_HEIGHT },
    rocket: { position: "absolute", width: PLAYER_WIDTH, alignItems: "center" },
    shieldAura: { position: 'absolute', top: -10, width: 60, height: 90, borderRadius: 30, borderWidth: 2, borderColor: '#00E5FF', backgroundColor: 'rgba(0, 229, 255, 0.2)' },
    rTip: { borderLeftWidth: 15, borderRightWidth: 15, borderBottomWidth: 20, borderStyle: 'solid', borderLeftColor: 'transparent', borderRightColor: 'transparent' },
    rBody: { width: 30, height: 45, backgroundColor: "#E0E0E0", borderRadius: 4, position: 'relative' },
    rWindow: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#333', marginTop: 8, alignSelf: 'center', borderWidth: 2, borderColor: '#FFF' },
    finLeft: { position: 'absolute', bottom: 0, left: -10, width: 10, height: 20, backgroundColor: '#999', borderTopLeftRadius: 10 },
    finRight: { position: 'absolute', bottom: 0, right: -10, width: 10, height: 20, backgroundColor: '#999', borderTopRightRadius: 10 },
    rFlame: { width: 18, height: 25, borderBottomLeftRadius: 15, borderBottomRightRadius: 15, marginTop: -2 },
    innerFlame: { width: 10, height: 15, backgroundColor: '#FFD700', borderRadius: 10, marginTop: 2, alignSelf: 'center' },
    obstacle: { position: "absolute" },
    shieldItem: { position: 'absolute', padding: 5, borderRadius: 20, backgroundColor: 'rgba(0, 229, 255, 0.3)', borderWidth: 1, borderColor: '#00E5FF' },
    controls: { flexDirection: 'row', justifyContent: 'center', flex: 1, alignItems: 'center' },
    ctrl: { padding: 30, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 20, marginHorizontal: 20 },
    ctrlTxt: { color: '#FFF', fontSize: 30 },
    modal: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center' }
});