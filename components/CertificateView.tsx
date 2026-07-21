/**
 * CertificateView.tsx
 * Premium landscape two-column certificate with professional design.
 * Optimized for readability and visual hierarchy.
 */

import React, { useMemo } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  Dimensions,
  Platform,
} from 'react-native';

// ─── Certificate Design Tokens ──────────────────────────────────────────────

const CERT = {
  bg: '#F8F6F0',  // warm cream background
  blue: '#2B4CBF',  // refined deep blue
  red: '#D32F2F',  // refined red
  green: '#2E7D32',  // refined green
  gold: '#C9952D',  // refined gold
  textDark: '#1A1A2E',  // near-black
  textMedium: '#4A4A5A',  // dark gray
  textLight: '#7A7A8A',  // light gray
  divider: '#D4D0C8',  // subtle divider
  borderLight: '#E8E4DC', // light border
};

const F_REGULAR = 'DMSans_400Regular';
const F_MEDIUM = 'DMSans_500Medium';
const F_BOLD = 'DMSans_700Bold';
const F_SERIF = Platform.select({
  ios: 'Georgia',
  android: 'serif',
  default: 'serif'
});

// Signature / script font for founder name
const F_SCRIPT = Platform.select({
  ios: 'Snell Roundhand',   // elegant cursive on iOS
  android: 'cursive',       // system cursive on Android
  default: 'cursive',
});

// ─── Dimensions ──────────────────────────────────────────────────────────────

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

const RAW_W = SCREEN_W - 32;
const RAW_H = RAW_W / 1.41;
const MAX_H = SCREEN_H * 0.46;
const H = Math.min(RAW_H, MAX_H);
const W = H * 1.41;

const LEFT_W = W * 0.40;
const RIGHT_W = W * 0.60;

// ─── Sub-components ──────────────────────────────────────────────────────────

/** Premium decorative header dots */
function HeaderDots() {
  const sz = H * 0.022;
  const gap = W * 0.006;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <View style={{ width: sz, height: sz, borderRadius: sz / 2, backgroundColor: CERT.red, marginRight: gap }} />
      <View style={{ width: sz, height: sz, borderRadius: sz / 2, backgroundColor: CERT.gold, marginRight: gap }} />
      <View style={{ width: sz, height: sz, borderRadius: sz / 2, backgroundColor: CERT.green }} />
    </View>
  );
}

/** Premium geometric art for left column */
function GeometricArt() {
  const artH = H * 0.45;
  const artW = LEFT_W;

  return (
    <View style={[s.artContainer, { height: artH }]}>
      {/* Base layer */}
      <View style={[s.artBase, { backgroundColor: CERT.blue }]} />

      {/* Overlapping geometric shapes */}
      <View style={[s.artShape, {
        bottom: artH * 0.15,
        left: artW * 0.06,
        width: artW * 0.42,
        height: artH * 0.55,
        backgroundColor: CERT.green,
        opacity: 0.9,
      }]} />

      <View style={[s.artShape, {
        top: artH * 0.10,
        right: artW * 0.08,
        width: artW * 0.28,
        height: artH * 0.28,
        borderRadius: artW * 0.14,
        backgroundColor: CERT.gold,
        opacity: 0.85,
      }]} />

      <View style={[s.artShape, {
        bottom: artH * 0.08,
        left: artW * 0.35,
        width: artW * 0.20,
        height: artH * 0.20,
        borderRadius: artW * 0.10,
        backgroundColor: CERT.red,
        opacity: 0.8,
      }]} />

      <View style={[s.artShape, {
        top: artH * 0.25,
        left: artW * 0.12,
        width: artW * 0.15,
        height: artH * 0.15,
        borderRadius: artW * 0.075,
        backgroundColor: '#FFFFFF',
        opacity: 0.15,
      }]} />

      {/* Decorative dots pattern */}
      <View style={[s.artShape, {
        bottom: artH * 0.25,
        right: artW * 0.12,
        flexDirection: 'row',
        flexWrap: 'wrap',
        width: artW * 0.15,
        height: artH * 0.15,
        justifyContent: 'space-between',
        alignContent: 'space-between',
      }]}>
        {[...Array(9)].map((_, i) => (
          <View key={i} style={{
            width: artW * 0.035,
            height: artW * 0.035,
            borderRadius: artW * 0.0175,
            backgroundColor: '#FFFFFF',
            opacity: 0.4,
          }} />
        ))}
      </View>

      {/* Decorative lines */}
      <View style={[s.artShape, {
        bottom: artH * 0.05,
        right: -artW * 0.05,
        width: artW * 0.35,
        height: artH * 0.80,
        opacity: 0.08,
      }]}>
        {[...Array(10)].map((_, i) => (
          <View key={i} style={{
            position: 'absolute',
            bottom: artH * 0.07 * i,
            right: 0,
            width: artW * 0.50,
            height: 1,
            backgroundColor: '#FFFFFF',
            transform: [{ rotate: '-40deg' }],
          }} />
        ))}
      </View>
    </View>
  );
}

/** Premium badge with star – aligned properly at top‑left of right column */
function PremiumBadge() {
  const size = H * 0.09;
  return (
    <View style={[s.badgeContainer, { width: size, height: size, borderRadius: size / 2 }]}>
      <View style={s.badgeInner}>
        <Text style={s.badgeStar}>★</Text>
        <Text style={s.badgeText}>PREMIUM</Text>
        <Text style={s.badgeSubtext}>AWARD</Text>
      </View>
    </View>
  );
}

/** Decorative corner element at top‑right */
function CornerDecoration() {
  const size = H * 0.07;
  const gap = H * 0.015;

  return (
    <View style={[s.cornerDecoration, { width: size + gap * 2, height: size + gap * 2 }]}>
      <View style={[s.cornerBox, {
        position: 'absolute',
        top: 0,
        right: 0,
        width: size,
        height: size,
        backgroundColor: CERT.blue,
        opacity: 0.9,
      }]} />
      <View style={[s.cornerBox, {
        position: 'absolute',
        bottom: 0,
        left: 0,
        width: size * 0.5,
        height: size * 0.5,
        backgroundColor: CERT.gold,
        opacity: 0.6,
      }]} />
      <View style={[s.cornerBox, {
        position: 'absolute',
        top: gap,
        right: gap,
        width: size * 0.3,
        height: size * 0.3,
        backgroundColor: CERT.red,
        opacity: 0.7,
      }]} />
    </View>
  );
}

// ─── Props ───────────────────────────────────────────────────────────────────

interface CertificateViewProps {
  userName: string;
  certificateNumber: string;
  issueDate: string;
  appName?: string;
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function CertificateView({
  userName,
  certificateNumber,
  issueDate,
  appName = 'Gastos',
}: CertificateViewProps) {

  const nameFontSize = useMemo(() => {
    const base = H * 0.072;
    if (userName.length > 30) return base * 0.55;
    if (userName.length > 22) return base * 0.70;
    if (userName.length > 16) return base * 0.85;
    return base;
  }, [userName, H]);

  const description = `Awarded for exceptional commitment to financial awareness and the discipline to take control of personal finances.`;

  return (
    <View style={s.certContainer}>
      <View style={s.cert}>

        {/* ─── LEFT COLUMN ──────────────────────── */}
        <View style={s.leftCol}>

          {/* Header with app icon */}
          <View style={s.headerRow}>
            <HeaderDots />
            <View style={{ width: W * 0.015 }} />
            <Image
              source={require('../assets/images/icon.png')}
              style={s.appIcon}
              resizeMode="cover"
            />
            <View style={{ width: W * 0.008 }} />
            <Text style={s.appNameText}>{appName}</Text>
          </View>

          {/* Title section */}
          <View style={s.titleSection}>
            <Text style={s.certTitle}>Certificate</Text>
            <Text style={s.certSubtitle}>OF FINANCIAL COMMITMENT</Text>
            <View style={s.titleDivider} />
          </View>

          {/* Art section */}
          <GeometricArt />
        </View>

        {/* ─── RIGHT COLUMN ─────────────────────── */}
        <View style={s.rightCol}>

          {/* Corner decorations */}
          <CornerDecoration />

          {/* Premium badge – now correctly aligned */}
          <PremiumBadge />

          {/* Presented to text */}
          <Text style={s.presentedText}>PROUDLY PRESENTED TO</Text>

          {/* User name */}
          <Text
            style={[s.userNameText, { fontSize: nameFontSize, lineHeight: nameFontSize * 1.2 }]}
            numberOfLines={4}
            adjustsFontSizeToFit
            minimumFontScale={0.5}
          >
            {userName}
          </Text>

          {/* Description */}
          <Text style={s.descriptionText}>
            {description}
          </Text>

          {/* Date */}
          <Text style={s.dateText}>Issue Date: {issueDate}</Text>

          {/* Signatures */}
          <View style={s.signaturesContainer}>
            {/* Left signature – Founder (script style) */}
            <View style={s.signatureBlock}>
              <Text style={s.signatureNameScript}>
                {appName === 'Gastos' ? 'Abhijith' : appName}
              </Text>
              <View style={s.signatureLine} />
              <Text style={s.signatureFullName}>Abhijith Binosh</Text>
              <Text style={s.signatureTitle}>Founder, {appName}</Text>
            </View>

            <View style={s.signatureSpacer} />

            {/* Right signature – App Brand */}
            <View style={s.signatureBlock}>
              <Text style={s.signatureLogo}>
                <Text style={{ color: CERT.blue }}>G</Text>
                <Text style={{ color: CERT.red }}>a</Text>
                <Text style={{ color: CERT.gold }}>s</Text>
                <Text style={{ color: CERT.green }}>t</Text>
                <Text style={{ color: CERT.blue }}>o</Text>
                <Text style={{ color: CERT.red }}>s</Text>
              </Text>
              <View style={s.signatureLine} />
              <Text style={s.signatureFullName}>Financial Tracker</Text>
              <Text style={s.signatureTitle}>Premium Finance App</Text>
            </View>
          </View>

          {/* Certificate number */}
          <Text style={s.certNumberText}>{certificateNumber}</Text>

        </View>
      </View>
    </View>
  );
}

// ─── StyleSheet ──────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  certContainer: {
    alignItems: 'center',
    paddingHorizontal: 16,
  },

  cert: {
    width: W,
    height: H,
    backgroundColor: CERT.bg,
    borderRadius: 12,
    overflow: 'hidden',
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: CERT.borderLight,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
      },
      android: {
        elevation: 8,
      },
    }),
  },

  // ── Left Column ────────────────────────────
  leftCol: {
    width: LEFT_W,
    height: H,
    backgroundColor: CERT.bg,
    paddingHorizontal: W * 0.03,
    paddingVertical: H * 0.04,
  },

  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: H * 0.015,
  },

  appIcon: {
    width: H * 0.045,
    height: H * 0.045,
    borderRadius: 4,
  },

  appNameText: {
    fontSize: H * 0.026,
    fontFamily: F_MEDIUM,
    color: CERT.textMedium,
    letterSpacing: 0.3,
  },

  titleSection: {
    marginTop: H * 0.005,
    marginBottom: H * 0.01,
  },

  certTitle: {
    fontSize: W * 0.038,
    fontFamily: F_BOLD,
    color: CERT.textDark,
    letterSpacing: -0.3,
    lineHeight: W * 0.038,
  },

  certSubtitle: {
    fontSize: W * 0.017,
    fontFamily: F_MEDIUM,
    color: CERT.textMedium,
    letterSpacing: 1.2,
    marginTop: H * 0.006,
  },

  titleDivider: {
    width: W * 0.20,
    height: 2,
    backgroundColor: CERT.gold,
    marginTop: H * 0.012,
  },

  artContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    overflow: 'hidden',
  },

  artBase: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    top: 0,
  },

  artShape: {
    position: 'absolute',
  },

  // ── Right Column ───────────────────────────
  rightCol: {
    width: RIGHT_W,
    height: H,
    backgroundColor: CERT.bg,
    paddingLeft: RIGHT_W * 0.06,
    paddingRight: RIGHT_W * 0.04,
    paddingTop: H * 0.04,
    paddingBottom: H * 0.26,
    position: 'relative',
  },

  cornerDecoration: {
    position: 'absolute',
    top: 0,
    right: 0,
  },

  cornerBox: {
    position: 'absolute',
  },

  badgeContainer: {
    backgroundColor: '#1A2B6B',
    borderWidth: 2,
    borderColor: CERT.gold,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: H * 0.012,
    alignSelf: 'flex-start', // ensures it stays on the left
  },

  badgeInner: {
    alignItems: 'center',
  },

  badgeStar: {
    fontSize: H * 0.025,
    color: CERT.gold,
    lineHeight: H * 0.028,
  },

  badgeText: {
    fontSize: H * 0.018,
    fontFamily: F_BOLD,
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },

  badgeSubtext: {
    fontSize: H * 0.015,
    fontFamily: F_MEDIUM,
    color: CERT.gold,
    letterSpacing: 0.3,
  },

  presentedText: {
    fontSize: H * 0.022,
    fontFamily: F_REGULAR,
    color: CERT.textLight,
    letterSpacing: 1.2,
    marginTop: H * 0.01,
  },

  userNameText: {
    fontFamily: F_SERIF,
    fontWeight: '700',
    color: CERT.textDark,
    textAlign: 'center',
    width: '100%',
    marginVertical: H * 0.005,
  },

  descriptionText: {
    fontSize: H * 0.02,
    fontFamily: F_REGULAR,
    color: CERT.textMedium,
    lineHeight: H * 0.028,
    marginTop: H * 0.005,
  },

  dateText: {
    fontSize: H * 0.022,
    fontFamily: F_REGULAR,
    color: CERT.textMedium,
    marginTop: H * 0.008,
  },

  signaturesContainer: {
    position: 'absolute',
    bottom: H * 0.05,
    left: RIGHT_W * 0.06,
    right: RIGHT_W * 0.04,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },

  signatureBlock: {
    flex: 1,
  },

  signatureSpacer: {
    width: W * 0.03,
  },

  // Signature name with script font
  signatureNameScript: {
    fontSize: H * 0.046,
    fontFamily: F_SCRIPT,
    color: CERT.textDark,
    lineHeight: H * 0.052,
    // extra spacing for script flair
    marginBottom: H * 0.002,
  },

  signatureLogo: {
    fontSize: H * 0.04,
    fontFamily: F_BOLD,
    fontStyle: 'italic',
    lineHeight: H * 0.046,
  },

  signatureLine: {
    width: '80%',
    height: 1.5,
    backgroundColor: CERT.divider,
    marginTop: H * 0.003,
    marginBottom: H * 0.004,
  },

  signatureFullName: {
    fontSize: H * 0.022,
    fontFamily: F_MEDIUM,
    color: CERT.textDark,
  },

  signatureTitle: {
    fontSize: H * 0.018,
    fontFamily: F_REGULAR,
    color: CERT.textLight,
    marginTop: H * 0.002,
  },

  certNumberText: {
    position: 'absolute',
    bottom: H * 0.02,
    left: RIGHT_W * 0.06,
    right: RIGHT_W * 0.04,
    fontSize: H * 0.018,
    fontFamily: F_REGULAR,
    color: CERT.textLight,
    letterSpacing: 0.5,
    textAlign: 'center',
  },
});