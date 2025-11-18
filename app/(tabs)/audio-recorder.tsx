/**
 * DEPRECATED: This file uses react-native-audio-api which has been removed.
 * Use turbo-audio-recorder.tsx instead, which uses react-native-audio-stream (our custom module)
 * For audio playback, use expo-audio instead.
 */

import React, { FC } from 'react';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { View, StyleSheet } from 'react-native';

const Record: FC = () => {
  return (
    <View style={styles.container}>
      <View style={styles.deprecationBox}>
        <Text style={styles.deprecatedTitle}>⚠️ DEPRECATED</Text>
        <Text style={styles.deprecatedText}>
          This tab used react-native-audio-api which has been removed from the project.
        </Text>
        <Text style={styles.deprecatedText}>
          Please use the "Turbo Audio Recorder" tab instead.
        </Text>
        <Text style={styles.infoText}>
          The new tab uses our custom react-native-audio-stream module with full iOS and Android support, WebSocket streaming, and automatic reconnection.
      </Text>
        <Text style={styles.infoText}>
          For audio playback, the project now uses expo-audio.
        </Text>
      </View>
    </View>
  );
};

export default Record;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#1a1a1a'
  },
  deprecationBox: {
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    padding: 24,
    borderWidth: 2,
    borderColor: '#ff9500',
    maxWidth: 400,
    gap: 16
  },
  deprecatedTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ff9500',
    textAlign: 'center'
  },
  deprecatedText: {
    fontSize: 16,
    color: '#ffffff',
    textAlign: 'center',
    lineHeight: 24
  },
  infoText: {
    fontSize: 14,
    color: '#999999',
    textAlign: 'center',
    lineHeight: 20
  }
});
