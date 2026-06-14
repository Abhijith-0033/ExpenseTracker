import React from 'react';
import { Text, TextStyle, StyleProp } from 'react-native';
import { Typography } from '../../constants/Theme';
import { formatAmount, getAmountColor } from '../../utils/formatUtils';

interface AmountTextProps {
    amount: number;
    type?: 'expense' | 'income' | 'transfer' | 'neutral';
    style?: StyleProp<TextStyle>;
    size?: keyof typeof Typography.size;
    weight?: keyof typeof Typography.family;
    showPrefix?: boolean;
}

export const AmountText: React.FC<AmountTextProps> = ({ 
    amount, 
    type = 'neutral', 
    style, 
    size = 'md', 
    weight = 'bold',
    showPrefix = true
}) => {
    const formattedText = showPrefix ? formatAmount(amount, type) : formatAmount(amount, 'neutral');
    const color = getAmountColor(type);

    return (
        <Text style={[
            {
                fontSize: Typography.size[size],
                fontFamily: Typography.family[weight],
                color: color
            },
            style
        ]}>
            {formattedText}
        </Text>
    );
};
