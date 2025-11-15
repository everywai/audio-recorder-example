import React, { FC, useEffect, useRef } from 'react';
import {
  AudioBuffer,
  AudioBufferSourceNode,
  AudioContext,
  AudioManager,
  AudioRecorder,
  RecorderAdapterNode,
} from 'react-native-audio-api';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { Dimensions, View } from 'react-native';

const { width } = Dimensions.get('screen');

export const layout = {
  spacing: 8,
  radius: 8,
  knobSize: 24,
  indicatorSize: 48,
  screenWidth: width,
} as const;

export const colors = {
  white: '#ffffff',
  main: '#38ACDD',
  black: '#000000',
  gray: '#d7d7d7',
  yellow: '#FFD61E',

  background: '#222222',
  backgroundDark: '#1f2020',
  backgroundLight: '#333333',

  separator: '#333333',
  modalBackdrop: '#00000040',
  border: '#999999',
} as const;


const SAMPLE_RATE = 16000;

const Record: FC = () => {
  const recorderRef = useRef<AudioRecorder | null>(null);
  const aCtxRef = useRef<AudioContext | null>(null);
  const recorderAdapterRef = useRef<RecorderAdapterNode | null>(null);
  const audioBuffersRef = useRef<AudioBuffer[]>([]);
  const sourcesRef = useRef<AudioBufferSourceNode[]>([]);

  useEffect(() => {
    const setup = async () => {
      try {
        await AudioManager.requestRecordingPermissions();
      } catch (err) {
        console.log(err);
        console.error('Recording permission denied', err);
        return;
      }

      recorderRef.current = new AudioRecorder({
        sampleRate: SAMPLE_RATE,
        bufferLengthInSamples: SAMPLE_RATE,
      });
    };

    setup();
    return () => {
      aCtxRef.current?.close();
      stopRecorder();
    };
  }, []);

  const setupRecording = () => {
    AudioManager.setAudioSessionOptions({
      iosCategory: 'playAndRecord',
      iosMode: 'spokenAudio',
      iosOptions: ['defaultToSpeaker', 'allowBluetoothA2DP'],
    });
  };

  const stopRecorder = () => {
    if (recorderRef.current) {
      recorderRef.current.stop();
      console.log('Recording stopped');
      // advised, but not required
      AudioManager.setAudioSessionOptions({
        iosCategory: 'playback',
        iosMode: 'default',
      });
    } else {
      console.error('AudioRecorder is not initialized');
    }
  };

  const startEcho = () => {
    if (!recorderRef.current) {
      console.error('AudioContext or AudioRecorder is not initialized');
      return;
    }
    setupRecording();

    aCtxRef.current = new AudioContext({ sampleRate: SAMPLE_RATE });
    recorderAdapterRef.current = aCtxRef.current.createRecorderAdapter();
    recorderAdapterRef.current.connect(aCtxRef.current.destination);
    recorderRef.current.connect(recorderAdapterRef.current);

    recorderRef.current.start();
    console.log('Recording started');
    console.log('Audio context state:', aCtxRef.current.state);
    if (aCtxRef.current.state === 'suspended') {
      console.log('Resuming audio context');
      aCtxRef.current.resume();
    }
  };

  /// This stops only the recording, not the audio context
  const stopEcho = () => {
    stopRecorder();
    aCtxRef.current = null;
    recorderAdapterRef.current = null;
  };

  const startRecordReplay = async () => {
    if (!recorderRef.current) {
      console.error('AudioRecorder is not initialized');
      return;
    }
    setupRecording();
    audioBuffersRef.current = [];

    recorderRef.current.onAudioReady((event) => {
      const { buffer, numFrames } = event;

      console.log('Audio recorder buffer ready:', buffer.duration, numFrames);
      audioBuffersRef.current.push(buffer);
    });

    await AudioManager.setAudioSessionActivity(true)

    recorderRef.current.start();

    setTimeout(() => {
      stopRecorder();
    }, 5000);
  };

  const stopRecordReplay = () => {
    const aCtx = new AudioContext({ sampleRate: SAMPLE_RATE });
    aCtxRef.current = aCtx;

    if (aCtx.state === 'suspended') {
      aCtx.resume();
    }

    const tNow = aCtx.currentTime;
    let nextStartAt = tNow + 1;
    const buffers = audioBuffersRef.current;

    console.log(tNow, nextStartAt, buffers.length);

    for (let i = 0; i < buffers.length; i++) {
      const source = aCtx.createBufferSource();
      source.buffer = buffers[i];

      source.connect(aCtx.destination);
      sourcesRef.current.push(source);

      source.start(nextStartAt);
      nextStartAt += buffers[i].duration;
    }

    setTimeout(
      () => {
        console.log('clearing data');
        audioBuffersRef.current = [];
        sourcesRef.current = [];
      },
      (nextStartAt - tNow) * 1000
    );
  };

  return (
    <View style={{ flex: 1, gap: 40 }}>
      <Text style={{ color: colors.gray, fontSize: 18, textAlign: 'center' }}>
        Sample rate: {SAMPLE_RATE}
      </Text>
      <View style={{ alignItems: 'center', gap: 10, paddingTop: 20 }}>
        <Text style={{ color: colors.white, fontSize: 16 }}>Echo</Text>
        <Button onPress={startEcho}><Text>Start Recording</Text></Button>
        <Button onPress={stopEcho}><Text>Stop Recording</Text></Button>
      </View>
      <View style={{ alignItems: 'center', gap: 10, paddingTop: 40 }}>
        <Text style={{ color: colors.white, fontSize: 16 }}>
          Record & replay
        </Text>
        <Button onPress={startRecordReplay}><Text>Record for Replay</Text></Button>
        <Button onPress={stopRecordReplay}><Text>Replay</Text></Button>
      </View>
    </View>
  );
};

export default Record;
