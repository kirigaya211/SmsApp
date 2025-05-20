import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  Image,
  PermissionsAndroid,
  Platform,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import SmsAndroid from 'react-native-get-sms-android';
import SmsListener from 'react-native-android-sms-listener';
import { useNavigation } from '@react-navigation/native';
import DatabaseHelper from '../database/DatabaseHelper';

const HomeScreen = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [messages, setMessages] = useState([]);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [classifying, setClassifying] = useState(false);
  const [permissionError, setPermissionError] = useState('');
  const [dbInitialized, setDbInitialized] = useState(false);
  const [pendingMessages, setPendingMessages] = useState([]);
  const navigation = useNavigation();

  // Function to call spam detection API
  const detectSpam = async (message, sender) => {
    try {
      // Ensure message and sender are not empty and are strings
      if (!message || typeof message !== 'string') {
        console.warn('Invalid message format:', message);
        return 'HAM';
      }
      if (!sender || typeof sender !== 'string') {
        console.warn('Invalid sender format:', sender);
        return 'HAM';
      }

      console.log('Sending to API:', { message, sender });
      const response = await fetch('https://capstone-model.onrender.com/predict', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          message: message,
          sender: sender,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        console.error('API Error Response:', errorData);
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('API Response:', data); // Debug log
      
      // Handle the API response format
      if (data.prediction) {
        return data.prediction; // API returns "SPAM" or "HAM" directly
      } else {
        console.warn('Unexpected API response format:', data);
        return 'HAM';
      }
    } catch (error) {
      console.error('Error calling spam detection API:', error);
      // More detailed error logging
      if (error.message.includes('Network request failed')) {
        console.error('Network error - Please check your internet connection');
      } else if (error.message.includes('HTTP error! status: 422')) {
        console.error('Invalid request format - Please check the message format');
      } else if (error.message.includes('HTTP error')) {
        console.error('Server error - Please try again later');
      }
      return 'HAM'; // Fallback to HAM if API call fails
    }
  };

  // Function to check if permissions are granted
  const checkPermissions = async () => {
    try {
      const readSmsGranted = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.READ_SMS);
      const receiveSmsGranted = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.RECEIVE_SMS);
      return readSmsGranted && receiveSmsGranted;
    } catch (err) {
      console.error('Error checking permissions:', err);
      return false;
    }
  };

  // Function to request permissions
  const requestPermissions = async () => {
    try {
      const granted = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.READ_SMS,
        PermissionsAndroid.PERMISSIONS.RECEIVE_SMS,
      ]);

      const allGranted = Object.values(granted).every(
        (permission) => permission === PermissionsAndroid.RESULTS.GRANTED
      );

      if (allGranted) {
        setPermissionGranted(true);
        setPermissionError('');
        startSmsMonitoring();
      } else {
        setPermissionGranted(false);
        setPermissionError('Please grant SMS permissions in your device settings to use this app.');
      }
    } catch (err) {
      console.error('Error requesting permissions:', err);
      setPermissionGranted(false);
      setPermissionError('Error requesting permissions. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Initialize database and start SMS monitoring
  useEffect(() => {
    const initializeApp = async () => {
      setLoading(true);
      try {
        // First check permissions
        const hasPermissions = await checkPermissions();
        
        if (hasPermissions) {
          setPermissionGranted(true);
          setPermissionError('');
          
          // Initialize database first
          console.log('Starting database initialization...');
          await DatabaseHelper.initDB();
          console.log('Database initialized successfully');
          setDbInitialized(true);

          // Then start SMS monitoring
          console.log('Starting SMS monitoring...');
          const subscription = SmsListener.addListener(message => {
            console.log('New SMS received via listener:', message);
            // Create a complete message object with all required fields
            const messageData = {
              _id: `${message.originatingAddress}-${message.timestamp}`,
              address: message.originatingAddress,
              body: message.body,
              date: message.timestamp,
              read: false
            };
            console.log('Processed message data:', messageData);
            processNewMessage(messageData);
          });

          // Fetch initial messages after database is initialized
          const filter = {
            box: 'inbox',
            maxCount: 50,
          };

          SmsAndroid.list(
            JSON.stringify(filter),
            (fail) => {
              console.error('Failed to fetch initial messages:', fail);
            },
            async (count, smsList) => {
              console.log('Fetched initial messages:', count);
              const arr = JSON.parse(smsList);
              // Process messages in reverse order (oldest first)
              for (const message of arr.reverse()) {
                const messageData = {
                  _id: message._id || `${message.address}-${message.date}`,
                  address: message.address,
                  body: message.body,
                  date: message.date,
                  read: message.read || false
                };
                await processNewMessage(messageData);
              }
            }
          );

          setLoading(false);
          console.log('SMS monitoring started successfully');

          // Return cleanup function
          return () => {
            console.log('Cleaning up SMS monitoring...');
            subscription.remove();
          };
        } else {
          await requestPermissions();
        }
      } catch (error) {
        console.error('Error during initialization:', error);
        setPermissionError('Error initializing app. Please restart.');
        setLoading(false);
      }
    };

    const cleanup = initializeApp();
    return () => {
      if (cleanup) cleanup();
    };
  }, []);

  // Process pending messages when database is initialized
  useEffect(() => {
    const processPendingMessages = async () => {
      if (dbInitialized && pendingMessages.length > 0) {
        console.log('Processing pending messages:', pendingMessages.length);
        for (const message of pendingMessages) {
          console.log('Processing pending message:', message);
          await processNewMessage(message);
        }
        setPendingMessages([]);
      }
    };
    processPendingMessages();
  }, [dbInitialized, pendingMessages]);

  // Function to process a new message
  const processNewMessage = async (message) => {
    if (!dbInitialized) {
      console.log('Database not initialized, adding message to pending queue:', message);
      setPendingMessages(prev => [...prev, message]);
      return;
    }

    try {
      console.log('Processing new message:', message);
      // Check if message exists in database
      const existingMessage = await DatabaseHelper.getMessageById(message._id || `${message.address}-${message.date}`);
      
      // If message exists and has classification, use it
      if (existingMessage && existingMessage.classification) {
        console.log('Message already exists with classification:', existingMessage.classification);
        setMessages(prevMessages => {
          const exists = prevMessages.some(msg => msg._id === existingMessage._id);
          if (!exists) {
            return [existingMessage, ...prevMessages];
          }
          return prevMessages;
        });
        return;
      }

      setClassifying(true);
      console.log('Calling detectSpam with:', { body: message.body, address: message.address });
      const classification = await detectSpam(message.body, message.address);
      console.log('Classification result:', classification);
      
      const newMessage = {
        _id: message._id || `${message.address}-${message.date}`,
        address: message.address,
        body: message.body,
        date: message.date || Date.now(),
        read: message.read || false,
        classification: classification,
      };

      console.log('Saving new message to database:', newMessage);
      // Save to database
      await DatabaseHelper.saveMessage(newMessage);

      setMessages(prevMessages => {
        const exists = prevMessages.some(msg => msg._id === newMessage._id);
        if (!exists) {
          return [newMessage, ...prevMessages];
        }
        return prevMessages;
      });
    } catch (error) {
      console.error('Error processing message:', error);
    } finally {
      setClassifying(false);
    }
  };

  // Function to update message classification
  const updateMessageClassification = async (messageId, newClassification) => {
    try {
      await DatabaseHelper.updateMessageClassification(messageId, newClassification);
      setMessages(prevMessages =>
        prevMessages.map(msg =>
          msg._id === messageId
            ? { ...msg, classification: newClassification }
            : msg
        )
      );
    } catch (error) {
      console.error('Error updating message classification:', error);
    }
  };

  // Function to start monitoring for new messages
  const startSmsMonitoring = () => {
    try {
      console.log('Starting SMS monitoring...');
      // Set up SMS listener for real-time incoming messages
      const subscription = SmsListener.addListener(message => {
        console.log('New SMS received via listener:', message);
        // Only process new messages that haven't been classified
        const messageData = {
          address: message.originatingAddress,
          body: message.messageBody,
          date: message.timestamp,
        };
        processNewMessage(messageData);
      });

      // Initial fetch of recent messages
      const filter = {
        box: 'inbox',
        maxCount: 20, // Get last 20 messages
      };

      SmsAndroid.list(
        JSON.stringify(filter),
        (fail) => {
          console.error('Failed to fetch initial messages:', fail);
        },
        (count, smsList) => {
          console.log('Fetched initial messages:', count);
          const arr = JSON.parse(smsList);
          // Process messages in reverse order (oldest first)
          arr.reverse().forEach(message => processNewMessage(message));
        }
      );

      setLoading(false);
      console.log('SMS monitoring started successfully');

      // Return cleanup function
      return () => {
        console.log('Cleaning up SMS monitoring...');
        subscription.remove();
      };
    } catch (error) {
      console.error('Error starting SMS monitoring:', error);
      setPermissionError('Error starting SMS monitoring. Please restart the app.');
      setLoading(false);
    }
  };

  // Group messages by sender
  const grouped = useMemo(() => {
    const map = {};
    messages.forEach((msg) => {
      if (!map[msg.address]) map[msg.address] = [];
      map[msg.address].push(msg);
    });
    // Convert to array and sort by latest message date
    return Object.entries(map)
      .map(([address, msgs]) => ({
        address,
        messages: msgs.sort((a, b) => b.date - a.date),
      }))
      .sort((a, b) => b.messages[0].date - a.messages[0].date);
  }, [messages]);

  // Filter by search
  const filteredGroups = grouped.filter(
    (group) =>
      group.address?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      group.messages.some((msg) =>
        msg.body?.toLowerCase().includes(searchQuery.toLowerCase())
      )
  );

  // Function to handle navigation to SmsScreen
  const handleNavigateToSms = (address, messages) => {
    navigation.navigate('Sms', {
      address,
      messages,
    });
  };

  const renderSender = ({ item }) => {
    const latest = item.messages[0];
    const classification = latest.classification || 'HAM';
    const badgeColor = classification === 'SPAM' ? '#ef4444' : '#22c55e';

    return (
      <Pressable
        style={styles.card}
        android_ripple={{ color: '#eee' }}
        onPress={() => handleNavigateToSms(item.address, item.messages)}
      >
        <View style={{ flex: 1 }}>
          <Text style={styles.sender}>{item.address}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
            <Text style={styles.preview} numberOfLines={1}>{latest.body}</Text>
            <View style={[styles.badge, { backgroundColor: badgeColor }]}> 
              <Text style={styles.badgeText}>{classification}</Text>
            </View>
          </View>
        </View>
        <Text style={styles.time}>{new Date(Number(latest.date)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
      </Pressable>
    );
  };

  // Listen for screen focus to reload messages
  useEffect(() => {
    if (!dbInitialized) return;

    const unsubscribe = navigation.addListener('focus', async () => {
      console.log('HomeScreen focused, reloading messages from database');
      try {
        const updatedMessages = await DatabaseHelper.getMessages();
        setMessages(updatedMessages);
      } catch (error) {
        console.error('Error reloading messages:', error);
      }
    });

    return unsubscribe;
  }, [navigation, dbInitialized]);

  return (
    <View style={{ flex: 1, backgroundColor: '#f4f4f8' }}>
      <Text style={{ fontSize: 28, fontWeight: 'bold', marginTop: 8, marginLeft: 19, marginBottom: 8, color: '#18181b' }}>Inbox</Text>
      <View style={styles.searchBarContainer}>
        <Image
          source={require('../assets/icons/search.png')}
          style={styles.searchIcon}
          resizeMode="contain"
        />
        <TextInput
          style={styles.searchInput}
          placeholder="Search"
          placeholderTextColor="#888"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>
      {loading ? (
        <Text style={{ textAlign: 'center', color: '#888', marginTop: 40 }}>Loading messages...</Text>
      ) : classifying ? (
        <View style={{ alignItems: 'center', marginTop: 40 }}>
          <ActivityIndicator size="large" color="#0000ff" />
          <Text style={{ textAlign: 'center', color: '#888', marginTop: 10 }}>Classifying messages...</Text>
        </View>
      ) : !permissionGranted ? (
        <View style={{ alignItems: 'center', marginTop: 40 }}>
          <Text style={{ textAlign: 'center', color: '#ef4444', marginTop: 40, marginHorizontal: 20 }}>
            {permissionError}
          </Text>
          <Pressable
            style={styles.retryButton}
            onPress={requestPermissions}
          >
            <Text style={styles.retryButtonText}>Grant Permissions</Text>
          </Pressable>
        </View>
      ) : filteredGroups.length === 0 ? (
        <Text style={{ textAlign: 'center', color: '#888', marginTop: 40 }}>Waiting for new messages...</Text>
      ) : (
        <FlatList
          data={filteredGroups}
          renderItem={renderSender}
          keyExtractor={(item) => item.address}
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 100 }}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  sender: {
    fontWeight: 'bold',
    fontSize: 17,
    color: '#18181b',
  },
  preview: {
    flex: 1,
    fontSize: 15,
    color: '#444',
    marginRight: 8,
  },
  badge: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginLeft: 4,
    alignSelf: 'center',
  },
  badgeText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 12,
    letterSpacing: 1,
  },
  time: {
    fontSize: 13,
    color: '#888',
    marginLeft: 10,
    fontWeight: '500',
    alignSelf: 'flex-start',
  },
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    marginHorizontal: 16,
    marginBottom: 18,
    paddingHorizontal: 14,
    paddingVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 4,
    elevation: 1,
  },
  searchIcon: {
    width: 22,
    height: 22,
    marginRight: 8,
    tintColor: '#888',
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#222',
    paddingVertical: 0,
  },
  retryButton: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 20,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default HomeScreen; 