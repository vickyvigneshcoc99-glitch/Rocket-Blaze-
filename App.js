import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from "react-native";

import * as Google from "expo-auth-session/providers/google";
import * as WebBrowser from "expo-web-browser";

import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithCredential,
  GoogleAuthProvider,
} from "firebase/auth";

import { auth } from "./firebase";

WebBrowser.maybeCompleteAuthSession();

export default function App() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  // 🔐 Google Login Setup
  const [request, response, promptAsync] = Google.useAuthRequest({
    expoClientId: "YOUR_EXPO_CLIENT_ID",
    androidClientId: "YOUR_ANDROID_CLIENT_ID",
    iosClientId: "YOUR_IOS_CLIENT_ID",
    webClientId: "YOUR_WEB_CLIENT_ID",
  });

  // ✅ Handle Google Login
  React.useEffect(() => {
    if (response?.type === "success") {
      const { id_token } = response.params;
      const credential = GoogleAuthProvider.credential(id_token);
      signInWithCredential(auth, credential);
    }
  }, [response]);

  // 📧 Email Login
  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert("Error", "Please fill all fields");
      return;
    }
    try {
      setLoading(true);
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      Alert.alert("Login Failed", err.message);
    } finally {
      setLoading(false);
    }
  };

  // 📝 Sign Up
  const handleSignup = async () => {
    if (!email || !password) {
      Alert.alert("Error", "Please fill all fields");
      return;
    }
    try {
      setLoading(true);
      await createUserWithEmailAndPassword(auth, email, password);
    } catch (err) {
      Alert.alert("Signup Failed", err.message);
    } finally {
      setLoading(false);
    }
  };

  // 🚀 Logged In Screen (Game Placeholder)
  if (auth.currentUser) {
    return (
      <View style={styles.gameContainer}>
        <Text style={styles.gameTitle}>🚀 Rocket Blaza</Text>
        <Text style={styles.welcome}>
          Welcome, {auth.currentUser.email}
        </Text>

        <TouchableOpacity
          style={styles.logoutBtn}
          onPress={() => auth.signOut()}
        >
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // 🔐 Login UI
  return (
    <View style={styles.container}>
      <Text style={styles.title}>🚀 Rocket Blaza</Text>
      <Text style={styles.subtitle}>Ignite. Dodge. Dominate.</Text>

      <View style={styles.card}>
        <TextInput
          placeholder="Email"
          placeholderTextColor="#999"
          style={styles.input}
          onChangeText={setEmail}
          value={email}
        />

        <TextInput
          placeholder="Password"
          placeholderTextColor="#999"
          secureTextEntry
          style={styles.input}
          onChangeText={setPassword}
          value={password}
        />

        {loading ? (
          <ActivityIndicator size="large" color="#05472A" />
        ) : (
          <>
            <TouchableOpacity style={styles.loginBtn} onPress={handleLogin}>
              <Text style={styles.btnText}>Login</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.signupBtn} onPress={handleSignup}>
              <Text style={styles.signupText}>Create Account</Text>
            </TouchableOpacity>

            <TouchableOpacity
              disabled={!request}
              style={styles.googleBtn}
              onPress={() => promptAsync()}
            >
              <Text style={styles.googleText}>Sign in with Google</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );
}

const EVERGREEN = "#05472A";

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },

  title: {
    fontSize: 36,
    fontWeight: "bold",
    color: EVERGREEN,
  },

  subtitle: {
    fontSize: 16,
    color: "#555",
    marginBottom: 30,
  },

  card: {
    width: "100%",
    backgroundColor: "#F9F9F9",
    borderRadius: 20,
    padding: 20,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 5,
  },

  input: {
    backgroundColor: "#FFF",
    padding: 15,
    borderRadius: 12,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: "#DDD",
  },

  loginBtn: {
    backgroundColor: EVERGREEN,
    padding: 15,
    borderRadius: 12,
    alignItems: "center",
  },

  btnText: {
    color: "#FFF",
    fontWeight: "bold",
    fontSize: 16,
  },

  signupBtn: {
    marginTop: 10,
    alignItems: "center",
  },

  signupText: {
    color: EVERGREEN,
    fontWeight: "600",
  },

  googleBtn: {
    marginTop: 20,
    backgroundColor: "#FFF",
    padding: 15,
    borderRadius: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: EVERGREEN,
  },

  googleText: {
    color: EVERGREEN,
    fontWeight: "bold",
  },

  gameContainer: {
    flex: 1,
    backgroundColor: EVERGREEN,
    justifyContent: "center",
    alignItems: "center",
  },

  gameTitle: {
    fontSize: 40,
    color: "#FFF",
    fontWeight: "bold",
  },

  welcome: {
    color: "#DFF5EA",
    marginTop: 10,
  },

  logoutBtn: {
    marginTop: 30,
    backgroundColor: "#FFF",
    padding: 12,
    borderRadius: 10,
  },

  logoutText: {
    color: EVERGREEN,
    fontWeight: "bold",
  },
});
