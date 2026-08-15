import * as SQLite from 'expo-sqlite';
import { addAccount } from '../services/database';

export const testAddAccount = async () => {
    try {
        console.log("Testing addAccount...");
        await addAccount("Union Bank Test", 100, "General Test");
        console.log("Successfully added account!");
    } catch (e) {
        console.error("EXACT ERROR:", e);
    }
};
