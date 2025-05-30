import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, FlatList, Pressable,Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import DatabaseHelper from '../database/DatabaseHelper';

const HamScreen = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [hamMessages, setHamMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigation = useNavigation();

  useEffect(() => {
    const loadMessages = async () => {
      try {
        const allMessages = await DatabaseHelper.getMessages();
        const hamOnly = allMessages.filter(msg => msg.classification === 'HAM');
        setHamMessages(hamOnly);
      } catch (error) {
        console.error('Error loading HAM messages:', error);
      } finally {
        setLoading(false);
      }
    };

    loadMessages();
  }, []);

  // Reload messages when screen is focused
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', async () => {
      try {
        const allMessages = await DatabaseHelper.getMessages();
        const hamOnly = allMessages.filter(msg => msg.classification === 'HAM');
        setHamMessages(hamOnly);
      } catch (error) {
        console.error('Error reloading HAM messages:', error);
      }
    });

    return unsubscribe;
  }, [navigation]);

  const filteredMessages = hamMessages.filter(msg => 
    msg.address.toLowerCase().includes(searchQuery.toLowerCase()) ||
    msg.body.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleMessagePress = (message) => {
    // Get all messages from the same sender
    const senderMessages = hamMessages.filter(msg => msg.address === message.address);
    navigation.navigate('Sms', {
      address: message.address,
      messages: senderMessages,
    });
  };

  const renderMessage = ({ item }) => (
    <Pressable
      style={styles.messageContainer}
      onPress={() => handleMessagePress(item)}
    >
      <View style={styles.messageHeader}>
        <Text style={styles.sender}>{item.address}</Text>
        <Text style={styles.time}>
          {new Date(Number(item.date)).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit'
          })}
        </Text>
      </View>
      <Text style={styles.message} numberOfLines={2}>{item.body}</Text>
    </Pressable>
  );

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Ham</Text>
      <View style={styles.searchBarContainer}>
        
        <Image
          source={require('../assets/icons/search.png')}
          style={styles.searchIcon}
          resizeMode="contain"
        />
          <TextInput
            style={styles.searchInput}
            placeholder="Search "
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor="#666"
          />
      </View>
      {loading ? (
        <Text style={styles.loadingText}>Loading messages...</Text>
      ) : filteredMessages.length === 0 ? (
        <Text style={styles.emptyText}>No HAM messages found</Text>
      ) : (
        <FlatList
          data={filteredMessages}
          renderItem={renderMessage}
          keyExtractor={item => item._id}
          style={styles.list}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f4f4f8',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginTop: 8,
    marginLeft: 19,
    marginBottom: 8,
    color: '#18181b',
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
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#222',
    paddingVertical: 0,
  },
  searchIcon: {
    width: 22,
    height: 22,
    marginRight: 8,
    tintColor: '#888',
  },
  list: {
    flex: 1,
  },
  messageContainer: {
    backgroundColor: '#fff',
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  messageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  sender: {
    fontSize: 16,
    fontWeight: '600',
    color: '#18181b',
  },
  time: {
    fontSize: 14,
    color: '#666',
  },
  message: {
    fontSize: 15,
    color: '#444',
    lineHeight: 20,
  },
  loadingText: {
    textAlign: 'center',
    marginTop: 20,
    color: '#666',
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 20,
    color: '#666',
  },
});

export default HamScreen; 