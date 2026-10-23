import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

/**
 * Primary UI component for user interaction
 *
 * @param {object} props
 * @param {boolean} [props.primary=false] Is this the principal call to action on the page?
 * @param {string} [props.backgroundColor] What background color to use
 * @param {'small' | 'medium' | 'large'} [props.size='medium'] How large should the button be?
 * @param {string} props.label Button contents
 * @param {() => void} [props.onPress] Optional click handler
 * @param {object} [props.style] Optional extra styles
 */
export const Button = ({
  primary = false,
  size = 'medium',
  backgroundColor,
  label,
  style,
  onPress,
}) => {
  const modeStyle = primary ? styles.primary : styles.secondary;
  const textModeStyle = primary ? styles.primaryText : styles.secondaryText;

  const sizeStyle = styles[size];
  const textSizeStyle = textSizeStyles[size];

  return (
    <TouchableOpacity accessibilityRole="button" activeOpacity={0.6} onPress={onPress}>
      <View
        style={[
          styles.button,
          modeStyle,
          sizeStyle,
          style,
          !!backgroundColor && { backgroundColor },
          { borderColor: 'black' },
        ]}
      >
        <Text style={[textModeStyle, textSizeStyle]}>{label}</Text>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    borderWidth: 0,
    borderRadius: 48,
  },
  buttonText: {
    fontWeight: '700',
    lineHeight: 1,
  },
  primary: {
    backgroundColor: '#555ab9',
  },
  primaryText: {
    color: 'white',
  },
  secondary: {
    backgroundColor: 'transparent',
    borderColor: 'rgba(0, 0, 0, 0.15)',
    color: '#333',
    borderWidth: 1,
  },
  secondaryText: {
    color: '#333',
  },
  small: {
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  smallText: {
    fontSize: 12,
  },
  medium: {
    paddingVertical: 11,
    paddingHorizontal: 20,
  },
  mediumText: {
    fontSize: 14,
  },
  large: {
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  largeText: {
    fontSize: 16,
  },
});

const textSizeStyles = {
  small: styles.smallText,
  medium: styles.mediumText,
  large: styles.largeText,
};
