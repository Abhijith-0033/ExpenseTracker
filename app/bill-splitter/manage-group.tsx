
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, X, Plus, Trash2 } from 'lucide-react-native';
import { Colors, Layout } from '../../constants/Theme';
import { addGroup, updateGroup, getGroupById, addMember, getGroupMembers, deleteMember } from '../../services/billSplitter';

export default function ManageGroupScreen() {
    const router = useRouter();
    const params = useLocalSearchParams();
    const isEditing = !!params.id;
    const groupId = params.id ? parseInt(params.id as string) : null;

    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [members, setMembers] = useState<{ id?: number, name: string }[]>([
        { name: '' }, { name: '' } // Start with 2 empty slots
    ]);
    const [loading, setLoading] = useState(false);
    const [initialLoading, setInitialLoading] = useState(isEditing);

    useEffect(() => {
        if (isEditing && groupId) {
            loadGroupData();
        }
    }, [isEditing, groupId]);

    const loadGroupData = async () => {
        try {
            const group = await getGroupById(groupId!);
            const groupMembers = await getGroupMembers(groupId!);
            if (group) {
                setName(group.name);
                setDescription(group.description || '');
                setMembers(groupMembers);
            }
        } catch (e) {
            Alert.alert('Error', 'Failed to load group details');
            router.back();
        } finally {
            setInitialLoading(false);
        }
    };

    const handleMemberChange = (text: string, index: number) => {
        const newMembers = [...members];
        newMembers[index].name = text;
        setMembers(newMembers);
    };

    const addMemberSlot = () => {
        setMembers([...members, { name: '' }]);
    };

    const removeMemberSlot = (index: number) => {
        if (members.length <= 2) {
            Alert.alert('Limit', 'A group must have at least 2 members');
            return;
        }

        // If editing and removing an existing member, we might need to delete from DB
        // But for simplicity in this form, let's just remove from UI list 
        // and handle "diff" on save, OR warn user.
        // Actually, for "Edit", it's safer to not allow removing members here to avoid complex conflict logic 
        // (what if they have expenses?). 
        // Let's allow removing only if it's a NEW slot (no ID).
        // If it has ID, we should establish a separate "Manage Members" flow or strict validation.

        const member = members[index];
        if (member.id) {
            Alert.alert('Cannot delete here', 'To remove existing members, please go to Group Details > Members.');
            return;
        }

        const newMembers = [...members];
        newMembers.splice(index, 1);
        setMembers(newMembers);
    };

    const handleSave = async () => {
        if (!name.trim()) {
            Alert.alert('Required', 'Please enter a group name');
            return;
        }

        const validMembers = members.filter(m => m.name.trim().length > 0);
        if (validMembers.length < 2) {
            Alert.alert('Required', 'Please add at least 2 members');
            return;
        }

        setLoading(true);
        try {
            let currentGroupId = groupId;

            // 1. Create/Update Group
            if (isEditing && currentGroupId) {
                await updateGroup(currentGroupId, name, description);
            } else {
                currentGroupId = await addGroup(name, description);
            }

            // 2. Add New Members
            // (Existing members are already in DB, we only add new ones without ID)
            // Note: We are NOT updating names of existing members here to keep it simple.
            for (const m of validMembers) {
                if (!m.id) {
                    await addMember(currentGroupId!, m.name);
                }
            }

            router.back();
        } catch (e) {
            console.error(e);
            Alert.alert('Error', 'Failed to save group');
        } finally {
            setLoading(false);
        }
    };

    if (initialLoading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={Colors.primary[600]} />
            </View>
        );
    }

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.container}
        >
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <ArrowLeft size={24} color={Colors.gray[900]} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>{isEditing ? 'Edit Group' : 'New Group'}</Text>
                <View style={{ width: 24 }} />
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent}>
                <View style={styles.section}>
                    <Text style={styles.label}>Group Name</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="e.g. Goa Trip, Roommates"
                        value={name}
                        onChangeText={setName}
                    />
                </View>

                <View style={styles.section}>
                    <Text style={styles.label}>Description (Optional)</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="Brief description..."
                        value={description}
                        onChangeText={setDescription}
                    />
                </View>

                <View style={styles.section}>
                    <Text style={styles.label}>Members</Text>
                    <Text style={styles.helperText}>Add the people who will be splitting expenses.</Text>

                    {members.map((member, index) => (
                        <View key={index} style={styles.memberRow}>
                            <TextInput
                                style={styles.memberInput}
                                placeholder={`Member ${index + 1}`}
                                value={member.name}
                                onChangeText={(text) => handleMemberChange(text, index)}
                                editable={!member.id} // Lock name editing for existing members here for simplicity
                            />
                            {(!member.id) && (
                                <TouchableOpacity onPress={() => removeMemberSlot(index)} style={styles.removeBtn}>
                                    <Trash2 size={20} color={Colors.gray[400]} />
                                </TouchableOpacity>
                            )}
                        </View>
                    ))}

                    <TouchableOpacity style={styles.addMemberBtn} onPress={addMemberSlot}>
                        <Plus size={20} color={Colors.primary[600]} />
                        <Text style={styles.addMemberText}>Add Member</Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>

            <View style={styles.footer}>
                <TouchableOpacity
                    style={[styles.saveBtn, loading && styles.saveBtnDisabled]}
                    onPress={handleSave}
                    disabled={loading}
                >
                    {loading ? (
                        <ActivityIndicator color="white" />
                    ) : (
                        <Text style={styles.saveBtnText}>{isEditing ? 'Save Changes' : 'Create Group'}</Text>
                    )}
                </TouchableOpacity>
            </View>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.white },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingTop: 60,
        paddingBottom: 20,
        borderBottomWidth: 1,
        borderBottomColor: Colors.gray[100],
    },
    backBtn: { padding: 4, marginLeft: -4 },
    headerTitle: { fontSize: 20, fontWeight: '700', color: Colors.gray[900] },
    scrollContent: { padding: 20, paddingBottom: 100 },
    section: { marginBottom: 24 },
    label: { fontSize: 16, fontWeight: '600', color: Colors.gray[900], marginBottom: 12 },
    helperText: { fontSize: 14, color: Colors.gray[500], marginBottom: 12, marginTop: -8 },
    input: {
        backgroundColor: Colors.gray[50],
        borderWidth: 1,
        borderColor: Colors.gray[200],
        borderRadius: 12,
        padding: 16,
        fontSize: 16,
        color: Colors.gray[900],
    },
    memberRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    memberInput: {
        flex: 1,
        backgroundColor: Colors.gray[50],
        borderWidth: 1,
        borderColor: Colors.gray[200],
        borderRadius: 12,
        padding: 14,
        fontSize: 16,
        color: Colors.gray[900],
    },
    removeBtn: {
        padding: 10,
        marginLeft: 8,
    },
    addMemberBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        borderWidth: 1,
        borderColor: Colors.primary[200],
        borderRadius: 12,
        borderStyle: 'dashed',
        backgroundColor: Colors.primary[50],
    },
    addMemberText: {
        marginLeft: 8,
        fontSize: 16,
        fontWeight: '600',
        color: Colors.primary[600],
    },
    footer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: Colors.white,
        padding: 20,
        borderTopWidth: 1,
        borderTopColor: Colors.gray[100],
    },
    saveBtn: {
        backgroundColor: Colors.primary[600],
        borderRadius: 16,
        paddingVertical: 18,
        alignItems: 'center',
    },
    saveBtnDisabled: {
        backgroundColor: Colors.primary[300],
    },
    saveBtnText: {
        color: 'white',
        fontSize: 16,
        fontWeight: 'bold',
    },
});
