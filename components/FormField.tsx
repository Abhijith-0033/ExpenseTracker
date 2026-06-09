import React, { useRef, useEffect } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  StyleSheet, 
  Animated, 
  TouchableOpacity, 
  KeyboardTypeOptions 
} from 'react-native';
import { Colors, Typography, Layout } from '../constants/Theme';

interface FormFieldProps {
  label: string;
  value: string;
  onChangeText?: (text: string) => void;
  error?: string;
  placeholder?: string;
  rightElement?: React.ReactNode;
  onPress?: () => void;
  required?: boolean;
  keyboardType?: KeyboardTypeOptions;
  multiline?: boolean;
  editable?: boolean;
  children?: React.ReactNode;
}

export const FormField: React.FC<FormFieldProps> = ({
  label,
  value,
  onChangeText,
  error,
  placeholder,
  rightElement,
  onPress,
  required,
  keyboardType = 'default',
  multiline = false,
  editable = true,
  children
}) => {
  const borderColor = useRef(new Animated.Value(0)).current; // 0: default, 1: focus, 2: error
  const errorOpacity = useRef(new Animated.Value(0)).current;
  const errorTranslateY = useRef(new Animated.Value(-4)).current;

  useEffect(() => {
    if (error) {
      Animated.parallel([
        Animated.timing(borderColor, {
          toValue: 2,
          duration: 200,
          useNativeDriver: false,
        }),
        Animated.spring(errorOpacity, {
          toValue: 1,
          useNativeDriver: true,
        }),
        Animated.spring(errorTranslateY, {
          toValue: 0,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(borderColor, {
          toValue: 0,
          duration: 200,
          useNativeDriver: false,
        }),
        Animated.timing(errorOpacity, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [borderColor, error, errorOpacity, errorTranslateY]);

  const onFocus = () => {
    if (!error) {
      Animated.timing(borderColor, {
        toValue: 1,
        duration: 200,
        useNativeDriver: false,
      }).start();
    }
  };

  const onBlur = () => {
    if (!error) {
      Animated.timing(borderColor, {
        toValue: 0,
        duration: 200,
        useNativeDriver: false,
      }).start();
    }
  };

  const animatedBorderColor = borderColor.interpolate({
    inputRange: [0, 1, 2],
    outputRange: [Colors.gray[200], Colors.primary[600], '#F04438'],
  });

  const animatedBorderWidth = borderColor.interpolate({
    inputRange: [0, 1, 2],
    outputRange: [1, 1.5, 1.5],
  });

  return (
    <View style={styles.container}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label}</Text>
        {required && <Text style={styles.required}>*</Text>}
      </View>

      <Animated.View 
        style={[
          styles.inputContainer, 
          { 
            borderColor: animatedBorderColor,
            borderWidth: animatedBorderWidth
          }
        ]}
      >
        {children ? (
          <View style={styles.childrenContainer}>{children}</View>
        ) : onPress ? (
          <TouchableOpacity style={styles.pressable} onPress={onPress} activeOpacity={0.7}>
            <Text 
              style={[
                styles.inputText, 
                !value && { color: Colors.gray[400] }
              ]}
              numberOfLines={1}
            >
              {value || placeholder}
            </Text>
            {rightElement}
          </TouchableOpacity>
        ) : (
          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.input}
              value={value}
              onChangeText={onChangeText}
              placeholder={placeholder}
              placeholderTextColor={Colors.gray[400]}
              onFocus={onFocus}
              onBlur={onBlur}
              keyboardType={keyboardType}
              multiline={multiline}
              editable={editable}
            />
            {rightElement}
          </View>
        )}
      </Animated.View>

      {error && (
        <Animated.View 
          style={[
            styles.errorContainer, 
            { opacity: errorOpacity, transform: [{ translateY: errorTranslateY }] }
          ]}
        >
          <Text style={styles.errorText}>⚠ {error}</Text>
        </Animated.View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
    width: '100%',
  },
  labelRow: {
    flexDirection: 'row',
    marginBottom: 6,
    alignItems: 'center',
  },
  label: {
    fontSize: Typography.size.xs,
    fontFamily: Typography.family.bold,
    color: Colors.gray[500],
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  required: {
    color: '#F04438',
    marginLeft: 2,
    fontSize: Typography.size.xs,
    fontFamily: Typography.family.bold,
  },
  inputContainer: {
    height: 52,
    backgroundColor: Colors.gray[100],
    borderRadius: Layout.radius.md,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    flex: 1,
  },
  input: {
    flex: 1,
    height: '100%',
    fontSize: Typography.size.md,
    fontFamily: Typography.family.medium,
    color: Colors.gray[900],
  },
  pressable: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
  },
  inputText: {
    fontSize: Typography.size.md,
    fontFamily: Typography.family.medium,
    color: Colors.gray[900],
    flex: 1,
  },
  childrenContainer: {
    flex: 1,
  },
  errorContainer: {
    marginTop: 4,
    paddingHorizontal: 4,
  },
  errorText: {
    fontSize: Typography.size.xs,
    fontFamily: Typography.family.medium,
    color: '#F04438',
  },
});
