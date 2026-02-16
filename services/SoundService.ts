import { Audio } from 'expo-av';

let expenseSound: Audio.Sound | null = null;
let incomeSound: Audio.Sound | null = null;
let isInitialized = false;

/**
 * Initializes the audio mode for the application.
 * Respects system silent mode and ducks other audio.
 */
export const initSoundService = async () => {
    if (isInitialized) return;
    try {
        await Audio.setAudioModeAsync({
            playsInSilentModeIOS: false,
            shouldDuckAndroid: true,
            playThroughEarpieceAndroid: false,
            staysActiveInBackground: false,
        });
        isInitialized = true;
    } catch (error) {
        console.warn("SoundService: Failed to set audio mode", error);
    }
};

/**
 * Plays the expense creation sound.
 * @param enabled Whether sound is enabled in settings.
 */
export const playExpenseSound = async (enabled: boolean = true) => {
    if (!enabled) return;
    await initSoundService();
    try {
        if (!expenseSound) {
            const { sound } = await Audio.Sound.createAsync(
                require('../assets/sounds/expense.wav')
            );
            expenseSound = sound;
        } else {
            await expenseSound.replayAsync();
            return;
        }
    } catch (error) {
        console.warn("SoundService: Failed to play expense sound", error);
    }
};

/**
 * Plays the income creation sound.
 * @param enabled Whether sound is enabled in settings.
 */
export const playIncomeSound = async (enabled: boolean = true) => {
    if (!enabled) return;
    await initSoundService();
    try {
        if (!incomeSound) {
            const { sound } = await Audio.Sound.createAsync(
                require('../assets/sounds/income.wav')
            );
            incomeSound = sound;
        } else {
            await incomeSound.replayAsync();
            return;
        }
    } catch (error) {
        console.warn("SoundService: Failed to play income sound", error);
    }
};

/**
 * Unloads sounds from memory.
 */
export const unloadSounds = async () => {
    try {
        if (expenseSound) {
            await expenseSound.unloadAsync();
            expenseSound = null;
        }
        if (incomeSound) {
            await incomeSound.unloadAsync();
            incomeSound = null;
        }
        isInitialized = false;
    } catch (error) {
        console.warn("SoundService: Failed to unload sounds", error);
    }
};
