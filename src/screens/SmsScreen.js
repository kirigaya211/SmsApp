import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Pressable,
  SafeAreaView,
  Alert,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import DatabaseHelper from '../database/DatabaseHelper';

const SmsScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { address } = route.params;
  const [messages, setMessages] = useState(route.params.messages);
  const [dbInitialized, setDbInitialized] = useState(false);

  // Initialize database
  useEffect(() => {
    const initDatabase = async () => {
      try {
        await DatabaseHelper.initDB();
        setDbInitialized(true);
      } catch (error) {
        console.error('Error initializing database:', error);
      }
    };
    initDatabase();
  }, []);

  const handleLongPress = (message) => {
    if (!dbInitialized) {
      Alert.alert('Error', 'Database not initialized');
      return;
    }

    Alert.alert(
      'Change Classification',
      'Do you want to change this message classification?',
      [
        {
          text: 'Mark as SPAM',
          onPress: () => updateClassification(message._id, 'SPAM'),
          style: 'destructive',
        },
        {
          text: 'Mark as HAM',
          onPress: () => updateClassification(message._id, 'HAM'),
        },
        {
          text: 'Cancel',
          style: 'cancel',
        },
      ]
    );
  };

  const updateClassification = async (messageId, newClassification) => {
    if (!dbInitialized) {
      Alert.alert('Error', 'Database not initialized');
      return;
    }

    try {
      await DatabaseHelper.updateMessageClassification(messageId, newClassification);
      // Update the messages state to trigger re-render
      setMessages(prevMessages =>
        prevMessages.map(msg =>
          msg._id === messageId
            ? { ...msg, classification: newClassification }
            : msg
        )
      );
    } catch (error) {
      console.error('Error updating classification:', error);
      Alert.alert('Error', 'Failed to update message classification');
    }
  };

  const renderMessage = ({ item }) => {
    const isSpam = item.classification === 'SPAM';
    const messageTime = new Date(Number(item.date)).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });

    return (
      <Pressable
        onLongPress={() => handleLongPress(item)}
        style={[
          styles.messageContainer,
          isSpam ? styles.spamMessage : styles.hamMessage
        ]}
      >
        <Text style={styles.messageText}>{item.body}</Text>
        <Text style={styles.messageTime}>{messageTime}</Text>
        {isSpam && (
          <View style={styles.spamBadge}>
            <Text style={styles.spamBadgeText}>SPAM</Text>
          </View>
        )}
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Text style={styles.backButtonText}>←</Text>
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {address}
        </Text>
      </View>
      <FlatList
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item) => item._id}
        contentContainerStyle={styles.messageList}
        inverted
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f4f4f8',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  backButton: {
    marginRight: 16,
  },
  backButtonText: {
    fontSize: 24,
    color: '#3b82f6',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#18181b',
    flex: 1,
  },
  messageList: {
    padding: 16,
  },
  messageContainer: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 16,
    marginBottom: 8,
  },
  hamMessage: {
    backgroundColor: '#fff',
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 4,
  },
  spamMessage: {
    backgroundColor: '#fee2e2',
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 16,
    color: '#18181b',
    marginBottom: 4,
  },
  messageTime: {
    fontSize: 12,
    color: '#666',
    alignSelf: 'flex-end',
  },
  spamBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#ef4444',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  spamBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
});

export default SmsScreen; 