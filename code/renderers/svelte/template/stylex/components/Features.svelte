<script lang="ts">
  import * as stylex from '@stylexjs/stylex';

  import { breakpoints, spacing } from '../consts.stylex';

  const highlight = stylex.keyframes({
    from: { backgroundColor: '#fde68a' },
    to: { backgroundColor: '#eff6ff' },
  });

  const styles = stylex.create({
    // Paused on its first frame, so the keyframe colour is stable for tests and snapshots
    animated: {
      animationDuration: '1s',
      animationName: highlight,
      animationPlayState: 'paused',
      backgroundColor: '#eff6ff',
    },
    spaced: {
      padding: spacing.gap,
    },
    button: {
      backgroundColor: {
        default: '#1d4ed8',
        ':disabled': '#9ca3af',
      },
      borderRadius: {
        default: 0,
        '@supports (display: grid)': 8,
      },
      color: {
        default: '#111827',
        [breakpoints.wide]: '#ffffff',
      },
    },
    label: {
      color: {
        default: '#111827',
        [stylex.when.siblingBefore(':checked')]: '#15803d',
      },
    },
  });
</script>

<div>
  <p data-testid="keyframes" {...stylex.attrs(styles.animated)}>keyframes</p>
  <p data-testid="consts" {...stylex.attrs(styles.spaced)}>defineConsts</p>
  <button data-testid="enabled" {...stylex.attrs(styles.button)}>Enabled</button>
  <button data-testid="disabled" disabled {...stylex.attrs(styles.button)}>Disabled</button>
  <div>
    <input id="stylex-marker" type="checkbox" {...stylex.attrs(stylex.defaultMarker())} />
    <label for="stylex-marker" data-testid="marked" {...stylex.attrs(styles.label)}>
      Green when the checkbox before it is checked
    </label>
  </div>
</div>
