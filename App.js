import React, { useEffect, useState } from "react";
import {
    View,
    Text,
    StyleSheet,
    Dimensions,
    TouchableOpacity,
    TextInput,
    FlatList,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as WebBrowser from "expo-web-browser";

WebBrowser.maybeCompleteAuthSession();

const { width, height } = Dimensions.get("window");

const PLAYER_WIDTH = 40;
const PLAYER_HEIGHT = 60;
const OBSTACLE_SIZE = 40;
const GAME_HEIGHT = height * 0.5; // Reduced to make room for leaderboard

export default function App() {
    const [loggedIn, setLoggedIn] = useState(false);
    const [username, setUsername] = useState("");
    const [playerX, setPlayerX] = useState(width / 2 - PLAYER_WIDTH / 2);
    const [obstacleY, setObstacleY] = useState(0);
    const [obstacleX, setObstacleX] = useState(Math.random() * (width - OBSTACLE_SIZE));
    const [score, setScore] = useState(0);
    const [gameOver, setGameOver] = useState(false);
    const [history, setHistory] = useState([]);

    // Load history on app start
    useEffect(() => {
        loadHistory();
    }, []);

    // Save score when game ends
    useEffect(() => {
        if (gameOver) {
            saveScore();
        }
    }, [gameOver]);

    const saveScore = async () => {
        try {
            const newEntry = {
                id: Date.now().toString(),
                name: username || "Guest",
                score: score,
                date: new Date().toLocaleDateString(),
            };
            const existingData = await AsyncStorage.getItem("rocket_scores");
            const currentHistory = existingData ? JSON.parse(existingData) : [];
            const updatedHistory = [newEntry, ...currentHistory].sort((a, b) => b.score - a.score);

            await AsyncStorage.setItem("rocket_scores", JSON.stringify(updatedHistory));
            setHistory(updatedHistory);
        } catch (e) {
            console.error("Failed to save score", e);
        }
    };

    const loadHistory = async () => {
        const data = await AsyncStorage.getItem("rocket_scores");
        if (data) setHistory(JSON.parse(data));
    };

    // 🎮 Game loop
    useEffect(() => {
        if (gameOver || !loggedIn) return;
        const interval = setInterval(() => {
            setObstacleY((y) => {
                if (y > GAME_HEIGHT) {
                    setScore((s) => s + 1);
                    setObstacleX(Math.random() * (width - OBSTACLE_SIZE));
                    return 0;
                }
                return y + 9;
            });
        }, 30);
        return () => clearInterval(interval);
    }, [gameOver, loggedIn]);

    // 💥 Collision logic
    useEffect(() => {
        if (!loggedIn || gameOver) return;
        const hit =
            obstacleY + OBSTACLE_SIZE > GAME_HEIGHT - PLAYER_HEIGHT &&
            obstacleX < playerX + PLAYER_WIDTH &&
            obstacleX + OBSTACLE_SIZE > playerX;
        if (hit) setGameOver(true);
    }, [obstacleY]);

    const restartGame = () => {
        setScore(0);
        setObstacleY(0);
        setObstacleX(Math.random() * (width - OBSTACLE_SIZE));
        setPlayerX(width / 2 - PLAYER_WIDTH / 2);
        setGameOver(false);
    };

    if (!loggedIn) {
        return (
            <View style={login.container}>
                <Text style={login.title}>🚀 Rocket Blaza</Text>
                <TextInput
                    placeholder="Enter Pilot Name"
                    style={login.input}
                    onChangeText={setUsername}
                />
                <TouchableOpacity style={login.loginBtn} onPress={() => setLoggedIn(true)}>
                    <Text style={login.loginText}>Launch Game</Text>
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <View style={game.container}>
            <Text style={game.title}>🚀 Rocket Blaza</Text>
            <Text style={game.score}>Score: {score}</Text>

            <View style={game.gameArea}>
                <View style={[game.obstacle, { top: obstacleY, left: obstacleX }]} />
                <View style={[game.rocketContainer, { left: playerX, top: GAME_HEIGHT - PLAYER_HEIGHT }]}>
                    <View style={game.rocketBody} />
                    <View style={game.rocketTip} />
                    <View style={game.rocketFlames} />
                </View>
            </View>

            <View style={game.uiOverlay}>
                {gameOver ? (
                    <TouchableOpacity style={game.restartBtn} onPress={restartGame}>
                        <Text style={game.restartText}>Restart Mission</Text>
                    </TouchableOpacity>
                ) : (
                    <View style={game.controls}>
                        <TouchableOpacity style={game.controlBtn} onPress={() => setPlayerX(x => Math.max(0, x - 40))}>
                            <Text style={game.controlText}>◀</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={game.controlBtn} onPress={() => setPlayerX(x => Math.min(width - PLAYER_WIDTH, x + 40))}>
                            <Text style={game.controlText}>▶</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </View>

            {/* 🏆 SCROLLABLE LEADERBOARD */}
            <View style={lb.container}>
                <Text style={lb.header}>🏆 Mission History</Text>
                <FlatList
                    data={history}
                    keyExtractor={(item) => item.id}
                    renderItem={({ item, index }) => (
                        <View style={lb.row}>
                            <Text style={lb.rank}>#{index + 1}</Text>
                            <Text style={lb.name}>{item.name}</Text>
                            <Text style={lb.scoreVal}>{item.score}</Text>
                        </View>
                    )}
                    ListEmptyComponent={<Text style={{ color: '#666', textAlign: 'center' }}>No flights recorded yet.</Text>}
                />
            </View>
        </View>
    );
}

// ================= NEW STYLES =================

const lb = StyleSheet.create({
    container: {
        flex: 1,
        width: '100%',
        backgroundColor: '#160d2b',
        padding: 20,
        borderTopLeftRadius: 30,
        borderTopRightRadius: 30,
    },
    header: { color: '#9B5CFF', fontSize: 18, fontWeight: 'bold', marginBottom: 10 },
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#251a3d',
    },
    rank: { color: '#9B5CFF', fontWeight: 'bold', width: 40 },
    name: { color: '#FFF', flex: 1 },
    scoreVal: { color: '#00FFCC', fontWeight: 'bold' }
});

const login = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#FFF", justifyContent: "center", alignItems: "center", padding: 20 },
    title: { fontSize: 34, fontWeight: "bold", color: "#05472A", marginBottom: 20 },
    input: { width: '80%', backgroundColor: "#F0F0F0", padding: 15, borderRadius: 12, marginBottom: 15 },
    loginBtn: { backgroundColor: "#05472A", padding: 15, borderRadius: 12, width: '80%', alignItems: "center" },
    loginText: { color: "#FFF", fontWeight: "bold" },
});

const game = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#0B0616", paddingTop: 50 },
    title: { color: "#9B5CFF", fontSize: 24, fontWeight: "bold", textAlign: 'center' },
    score: { color: "#E0D7FF", textAlign: 'center', marginBottom: 10 },
    gameArea: { width, height: GAME_HEIGHT, backgroundColor: "#140A24", overflow: 'hidden' },
    obstacle: { position: "absolute", width: OBSTACLE_SIZE, height: OBSTACLE_SIZE, backgroundColor: "#FF4D6D", borderRadius: 8 },
    rocketContainer: { position: "absolute", width: PLAYER_WIDTH, height: PLAYER_HEIGHT, alignItems: "center" },
    rocketBody: { width: 20, height: 40, backgroundColor: "#9B5CFF", borderRadius: 6 },
    rocketTip: { width: 0, height: 0, borderLeftWidth: 10, borderRightWidth: 10, borderBottomWidth: 15, borderStyle: "solid", borderLeftColor: "transparent", borderRightColor: "transparent", borderBottomColor: "#9B5CFF" },
    rocketFlames: { width: 10, height: 15, backgroundColor: "#FF9500", marginTop: -2, borderRadius: 5 },
    uiOverlay: { height: 100, justifyContent: 'center', alignItems: 'center' },
    controls: { flexDirection: "row" },
    controlBtn: { backgroundColor: "#9B5CFF", padding: 15, marginHorizontal: 20, borderRadius: 50 },
    controlText: { color: "#FFF", fontSize: 20 },
    restartBtn: { backgroundColor: "#FF4D6D", padding: 12, borderRadius: 12 },
    restartText: { color: "#FFF", fontWeight: "bold" },
});