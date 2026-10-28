import { StyleSheet, Text, View } from 'react-native';

import { Button } from './Button';

/**
 * @param {object} props
 * @param {{ name: string }} [props.user] The signed-in user, if any
 * @param {() => void} [props.onLogin] Called when the user presses Log in
 * @param {() => void} [props.onLogout] Called when the user presses Log out
 * @param {() => void} [props.onCreateAccount] Called when the user presses Sign up
 */
export const Header = ({ user, onLogin, onLogout, onCreateAccount }) => (
  <View>
    <View style={styles.wrapper}>
      <View style={styles.logoContainer}>
        <Text style={styles.h1}>Acme</Text>
      </View>

      <View style={styles.buttonContainer}>
        {user ? (
          <>
            <Text>Welcome, </Text>
            <Text style={styles.userName}>{user.name}!</Text>

            <Button style={styles.button} size="small" onPress={onLogout} label="Log out" />
          </>
        ) : (
          <>
            <Button style={styles.button} size="small" onPress={onLogin} label="Log in" />
            <Button
              style={styles.button}
              primary
              size="small"
              onPress={onCreateAccount}
              label="Sign up"
            />
          </>
        )}
      </View>
    </View>
  </View>
);

const styles = StyleSheet.create({
  wrapper: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
    paddingVertical: 15,
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  h1: {
    fontWeight: '900',
    fontSize: 20,
    marginTop: 6,
    marginBottom: 6,
    marginLeft: 10,
    color: 'black',
    alignSelf: 'flex-start',
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  button: {
    marginLeft: 10,
  },
  buttonContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  userName: {
    fontWeight: '700',
  },
});
