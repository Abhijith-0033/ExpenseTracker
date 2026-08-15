import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  StatusBar,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  ArrowLeft,
  Check,
  Palette,
  Moon,
  Sun,
  Smartphone,
  Type,
  LayoutGrid,
  CreditCard,
  ListFilter,
  SlidersHorizontal,
  RotateCcw,
  ChevronUp,
  ChevronDown,
  Layers,
  Sparkles,
  Eye,
  EyeOff,
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  useTheme,
  ColorPalette,
  ThemeMode,
  FontScale,
  RadiusDensity,
  BalanceCardVariant,
  TransactionDensity,
  TabBarStyle,
} from '../context/ThemeContext';
import { PressableScale } from '../components/ui/PressableScale';
import { ConfirmActionSheet } from '../components/ConfirmActionSheet';

const PALETTE_OPTIONS: { id: ColorPalette; name: string; color: string }[] = [
  { id: 'coral', name: 'Warm Coral', color: '#E8917A' },
  { id: 'emerald', name: 'Emerald', color: '#10B981' },
  { id: 'blue', name: 'Royal Blue', color: '#3B82F6' },
  { id: 'purple', name: 'Amethyst', color: '#8B5CF6' },
  { id: 'orange', name: 'Amber Gold', color: '#F59E0B' },
  { id: 'midnight', name: 'Indigo Dark', color: '#6366F1' },
];

const MODE_OPTIONS: { id: ThemeMode; name: string; icon: any }[] = [
  { id: 'light', name: 'Light', icon: Sun },
  { id: 'dark', name: 'Dark', icon: Moon },
  { id: 'system', name: 'System', icon: Smartphone },
];

const FONT_SCALE_OPTIONS: { id: FontScale; name: string; sizeLabel: string }[] = [
  { id: 'sm', name: 'Small', sizeLabel: 'A-' },
  { id: 'md', name: 'Normal', sizeLabel: 'A' },
  { id: 'lg', name: 'Large', sizeLabel: 'A+' },
  { id: 'xl', name: 'Extra Large', sizeLabel: 'A++' },
];

const RADIUS_OPTIONS: { id: RadiusDensity; name: string; radiusVal: number }[] = [
  { id: 'sharp', name: 'Sharp', radiusVal: 8 },
  { id: 'medium', name: 'Medium', radiusVal: 16 },
  { id: 'round', name: 'Round', radiusVal: 24 },
  { id: 'pill', name: 'Pill', radiusVal: 32 },
];

const BALANCE_CARD_VARIANTS: { id: BalanceCardVariant; name: string; desc: string }[] = [
  { id: 'gradient_flip', name: 'Gradient Flip', desc: 'Coral brand gradient with account breakdown flip' },
  { id: 'minimal_white', name: 'Minimal White', desc: 'Clean high-contrast minimal surface card' },
  { id: 'compact_dark', name: 'Compact Dark', desc: 'Dark solid surface with inline accounts list' },
  { id: 'net_worth', name: 'Net Worth View', desc: 'Shows Assets vs Liabilities indicator' },
];

const DENSITY_OPTIONS: { id: TransactionDensity; name: string; desc: string }[] = [
  { id: 'comfortable', name: 'Comfortable', desc: 'Spacious padding, large category icons' },
  { id: 'compact', name: 'Compact', desc: 'Medium padding, compact rows' },
  { id: 'ultra', name: 'Ultra-Compact', desc: 'Dense list, hides subcategory for high speed' },
];

const TAB_BAR_OPTIONS: { id: TabBarStyle; name: string; desc: string }[] = [
  { id: 'floating', name: 'Floating Pill', desc: 'Floating rounded bottom bar' },
  { id: 'standard', name: 'Standard Bottom', desc: 'Flush bottom bar with border' },
  { id: 'minimal', name: 'Floating + Labels', desc: 'Floating bar with visible section labels' },
];

export default function ThemeSettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const {
    themeConfig,
    dashboardWidgets,
    sidePanelItems,
    colors,
    typography,
    radius,
    isDark,
    updateTheme,
    updateWidgets,
    updateSidePanel,
    resetAll,
  } = useTheme();

  const [confirmReset, setConfirmReset] = useState(false);

  const moveWidget = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= dashboardWidgets.length) return;

    const list = [...dashboardWidgets];
    const temp = list[index];
    list[index] = list[targetIndex];
    list[targetIndex] = temp;

    // Update order property
    const updated = list.map((w, idx) => ({ ...w, order: idx }));
    updateWidgets(updated);
  };

  const toggleWidgetVisibility = (id: string) => {
    const updated = dashboardWidgets.map(w => {
      if (w.id === id) {
        return { ...w, visible: !w.visible };
      }
      return w;
    });
    updateWidgets(updated);
  };

  const toggleSidePanelVisibility = (id: string) => {
    const updated = sidePanelItems.map(item => {
      if (item.id === id) {
        return { ...item, visible: !item.visible };
      }
      return item;
    });
    updateSidePanel(updated);
  };

  return (
    <View style={[styles.mainContainer, { backgroundColor: colors.gray[50] }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />

      {/* Full-screen Header with Top Inset */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 20) + 8, borderBottomColor: colors.gray[200], backgroundColor: colors.white }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <ArrowLeft size={22} color={colors.gray[900]} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.gray[900] }]}>Theme & Customization</Text>
        <TouchableOpacity style={styles.resetHeaderBtn} onPress={() => setConfirmReset(true)}>
          <RotateCcw size={18} color={colors.primary[600]} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ padding: 16, paddingBottom: 60 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Color Palette Section */}
        <View style={[styles.cardSection, { backgroundColor: colors.white, borderRadius: radius.lg }]}>
          <View style={styles.sectionHeaderRow}>
            <Palette size={20} color={colors.primary[600]} />
            <Text style={[styles.sectionTitle, { color: colors.gray[900] }]}>Color Theme</Text>
          </View>
          <Text style={[styles.sectionSubtitle, { color: colors.gray[500] }]}>
            Select your preferred accent brand palette
          </Text>

          <View style={styles.paletteGrid}>
            {PALETTE_OPTIONS.map(p => {
              const selected = themeConfig.palette === p.id;
              return (
                <PressableScale
                  key={p.id}
                  style={[
                    styles.paletteCard,
                    {
                      borderColor: selected ? p.color : colors.gray[200],
                      backgroundColor: selected ? `${p.color}15` : colors.gray[50],
                    },
                  ]}
                  onPress={() => updateTheme({ palette: p.id })}
                >
                  <View style={[styles.swatchCircle, { backgroundColor: p.color }]}>
                    {selected && <Check size={14} color="#FFF" strokeWidth={3} />}
                  </View>
                  <Text
                    style={[
                      styles.paletteName,
                      { color: selected ? colors.gray[900] : colors.gray[600] },
                    ]}
                  >
                    {p.name}
                  </Text>
                </PressableScale>
              );
            })}
          </View>

          {/* Live Palette Preview Card */}
          <LinearGradient
            colors={[colors.primary[600], colors.primary[400]]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.previewCard, { borderRadius: radius.md }]}
          >
            <View style={styles.previewHeader}>
              <Sparkles size={16} color="white" />
              <Text style={styles.previewTitle}>Live Brand Preview</Text>
            </View>
            <Text style={styles.previewAmount}>₹1,24,500.00</Text>
            <Text style={styles.previewSub}>Active theme accent preview</Text>
          </LinearGradient>
        </View>

        {/* Display Mode */}
        <View style={[styles.cardSection, { backgroundColor: colors.white, borderRadius: radius.lg }]}>
          <View style={styles.sectionHeaderRow}>
            <Sun size={20} color={colors.primary[600]} />
            <Text style={[styles.sectionTitle, { color: colors.gray[900] }]}>Display Mode</Text>
          </View>

          <View style={styles.optionsRow}>
            {MODE_OPTIONS.map(m => {
              const selected = themeConfig.mode === m.id;
              const IconComp = m.icon;
              return (
                <TouchableOpacity
                  key={m.id}
                  style={[
                    styles.modePill,
                    {
                      backgroundColor: selected ? colors.primary[500] : colors.gray[100],
                      borderRadius: radius.md,
                    },
                  ]}
                  onPress={() => updateTheme({ mode: m.id })}
                >
                  <IconComp size={18} color={selected ? '#FFF' : colors.gray[700]} />
                  <Text
                    style={[
                      styles.modePillText,
                      { color: selected ? '#FFF' : colors.gray[700] },
                    ]}
                  >
                    {m.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Font Scale Section */}
        <View style={[styles.cardSection, { backgroundColor: colors.white, borderRadius: radius.lg }]}>
          <View style={styles.sectionHeaderRow}>
            <Type size={20} color={colors.primary[600]} />
            <Text style={[styles.sectionTitle, { color: colors.gray[900] }]}>Font Scale</Text>
          </View>

          <View style={styles.optionsRow}>
            {FONT_SCALE_OPTIONS.map(f => {
              const selected = themeConfig.fontScale === f.id;
              return (
                <TouchableOpacity
                  key={f.id}
                  style={[
                    styles.fontOption,
                    {
                      backgroundColor: selected ? colors.primary[50] : colors.gray[50],
                      borderColor: selected ? colors.primary[500] : colors.gray[200],
                      borderRadius: radius.md,
                    },
                  ]}
                  onPress={() => updateTheme({ fontScale: f.id })}
                >
                  <Text style={[styles.fontLabel, { color: selected ? colors.primary[600] : colors.gray[800] }]}>
                    {f.sizeLabel}
                  </Text>
                  <Text style={[styles.fontSub, { color: colors.gray[500] }]}>{f.name}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <Text style={[styles.previewTextSample, { color: colors.gray[900], fontSize: typography.size.md }]}>
            Sample: ₹4,850 • Grocery & Snacks
          </Text>
        </View>

        {/* Corner Radius Density */}
        <View style={[styles.cardSection, { backgroundColor: colors.white, borderRadius: radius.lg }]}>
          <View style={styles.sectionHeaderRow}>
            <Layers size={20} color={colors.primary[600]} />
            <Text style={[styles.sectionTitle, { color: colors.gray[900] }]}>Card Corner Radius</Text>
          </View>

          <View style={styles.radiusGrid}>
            {RADIUS_OPTIONS.map(r => {
              const selected = themeConfig.radiusDensity === r.id;
              return (
                <TouchableOpacity
                  key={r.id}
                  style={[
                    styles.radiusTile,
                    {
                      borderRadius: r.radiusVal,
                      borderColor: selected ? colors.primary[500] : colors.gray[300],
                      backgroundColor: selected ? `${colors.primary[500]}10` : colors.gray[50],
                    },
                  ]}
                  onPress={() => updateTheme({ radiusDensity: r.id })}
                >
                  <Text style={[styles.radiusTileText, { color: selected ? colors.primary[600] : colors.gray[700] }]}>
                    {r.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Dashboard Widgets Customizer */}
        <View style={[styles.cardSection, { backgroundColor: colors.white, borderRadius: radius.lg }]}>
          <View style={styles.sectionHeaderRow}>
            <LayoutGrid size={20} color={colors.primary[600]} />
            <Text style={[styles.sectionTitle, { color: colors.gray[900] }]}>Dashboard Layout</Text>
          </View>
          <Text style={[styles.sectionSubtitle, { color: colors.gray[500] }]}>
            Reorder and show or hide dashboard sections
          </Text>

          <View style={styles.widgetList}>
            {dashboardWidgets.map((widget, index) => (
              <View
                key={widget.id}
                style={[
                  styles.widgetRow,
                  { borderBottomColor: colors.gray[100], backgroundColor: widget.visible ? colors.white : colors.gray[50] },
                ]}
              >
                <View style={styles.reorderBtns}>
                  <TouchableOpacity
                    disabled={index === 0}
                    style={[styles.arrowBtn, index === 0 && { opacity: 0.3 }]}
                    onPress={() => moveWidget(index, 'up')}
                  >
                    <ChevronUp size={16} color={colors.gray[600]} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    disabled={index === dashboardWidgets.length - 1}
                    style={[styles.arrowBtn, index === dashboardWidgets.length - 1 && { opacity: 0.3 }]}
                    onPress={() => moveWidget(index, 'down')}
                  >
                    <ChevronDown size={16} color={colors.gray[600]} />
                  </TouchableOpacity>
                </View>

                <View style={{ flex: 1, paddingHorizontal: 8 }}>
                  <Text style={[styles.widgetName, { color: colors.gray[900] }]}>{widget.label}</Text>
                  <Text style={[styles.widgetDesc, { color: colors.gray[500] }]}>{widget.description}</Text>
                </View>

                <Switch
                  disabled={widget.locked}
                  value={widget.visible}
                  onValueChange={() => toggleWidgetVisibility(widget.id)}
                  trackColor={{ true: colors.primary[500], false: colors.gray[200] }}
                  thumbColor="#FFF"
                />
              </View>
            ))}
          </View>
        </View>

        {/* Balance Card Variants */}
        <View style={[styles.cardSection, { backgroundColor: colors.white, borderRadius: radius.lg }]}>
          <View style={styles.sectionHeaderRow}>
            <CreditCard size={20} color={colors.primary[600]} />
            <Text style={[styles.sectionTitle, { color: colors.gray[900] }]}>Balance Card Style</Text>
          </View>

          <View style={styles.variantList}>
            {BALANCE_CARD_VARIANTS.map(v => {
              const selected = themeConfig.balanceCardVariant === v.id;
              return (
                <TouchableOpacity
                  key={v.id}
                  style={[
                    styles.variantRow,
                    {
                      borderColor: selected ? colors.primary[500] : colors.gray[200],
                      backgroundColor: selected ? `${colors.primary[500]}08` : colors.gray[50],
                      borderRadius: radius.md,
                    },
                  ]}
                  onPress={() => updateTheme({ balanceCardVariant: v.id })}
                >
                  <View style={styles.radioDotOuter}>
                    {selected && <View style={[styles.radioDotInner, { backgroundColor: colors.primary[500] }]} />}
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={[styles.variantName, { color: colors.gray[900] }]}>{v.name}</Text>
                    <Text style={[styles.variantDesc, { color: colors.gray[500] }]}>{v.desc}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Transaction Density */}
        <View style={[styles.cardSection, { backgroundColor: colors.white, borderRadius: radius.lg }]}>
          <View style={styles.sectionHeaderRow}>
            <ListFilter size={20} color={colors.primary[600]} />
            <Text style={[styles.sectionTitle, { color: colors.gray[900] }]}>Transaction Density</Text>
          </View>

          <View style={styles.variantList}>
            {DENSITY_OPTIONS.map(d => {
              const selected = themeConfig.transactionDensity === d.id;
              return (
                <TouchableOpacity
                  key={d.id}
                  style={[
                    styles.variantRow,
                    {
                      borderColor: selected ? colors.primary[500] : colors.gray[200],
                      backgroundColor: selected ? `${colors.primary[500]}08` : colors.gray[50],
                      borderRadius: radius.md,
                    },
                  ]}
                  onPress={() => updateTheme({ transactionDensity: d.id })}
                >
                  <View style={styles.radioDotOuter}>
                    {selected && <View style={[styles.radioDotInner, { backgroundColor: colors.primary[500] }]} />}
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={[styles.variantName, { color: colors.gray[900] }]}>{d.name}</Text>
                    <Text style={[styles.variantDesc, { color: colors.gray[500] }]}>{d.desc}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Tab Bar Style */}
        <View style={[styles.cardSection, { backgroundColor: colors.white, borderRadius: radius.lg }]}>
          <View style={styles.sectionHeaderRow}>
            <SlidersHorizontal size={20} color={colors.primary[600]} />
            <Text style={[styles.sectionTitle, { color: colors.gray[900] }]}>Tab Bar Style</Text>
          </View>

          <View style={styles.variantList}>
            {TAB_BAR_OPTIONS.map(t => {
              const selected = themeConfig.tabBarStyle === t.id;
              return (
                <TouchableOpacity
                  key={t.id}
                  style={[
                    styles.variantRow,
                    {
                      borderColor: selected ? colors.primary[500] : colors.gray[200],
                      backgroundColor: selected ? `${colors.primary[500]}08` : colors.gray[50],
                      borderRadius: radius.md,
                    },
                  ]}
                  onPress={() => updateTheme({ tabBarStyle: t.id })}
                >
                  <View style={styles.radioDotOuter}>
                    {selected && <View style={[styles.radioDotInner, { backgroundColor: colors.primary[500] }]} />}
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={[styles.variantName, { color: colors.gray[900] }]}>{t.name}</Text>
                    <Text style={[styles.variantDesc, { color: colors.gray[500] }]}>{t.desc}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Header Display Preferences */}
        <View style={[styles.cardSection, { backgroundColor: colors.white, borderRadius: radius.lg }]}>
          <View style={styles.sectionHeaderRow}>
            <Eye size={20} color={colors.primary[600]} />
            <Text style={[styles.sectionTitle, { color: colors.gray[900] }]}>Header Display</Text>
          </View>

          <View style={styles.toggleRow}>
            <Text style={[styles.toggleText, { color: colors.gray[900] }]}>Show Greeting Text</Text>
            <Switch
              value={themeConfig.showGreeting}
              onValueChange={v => updateTheme({ showGreeting: v })}
              trackColor={{ true: colors.primary[500], false: colors.gray[200] }}
              thumbColor="#FFF"
            />
          </View>

          <View style={[styles.toggleRow, { borderBottomWidth: 0 }]}>
            <Text style={[styles.toggleText, { color: colors.gray[900] }]}>Show Subtitle Date</Text>
            <Switch
              value={themeConfig.showDate}
              onValueChange={v => updateTheme({ showDate: v })}
              trackColor={{ true: colors.primary[500], false: colors.gray[200] }}
              thumbColor="#FFF"
            />
          </View>

          <View style={[styles.toggleRow, { borderBottomWidth: 0 }]}>
            <Text style={[styles.toggleText, { color: colors.gray[900] }]}>Show Rupee Coin Animation 🪙</Text>
            <Switch
              value={themeConfig.showRupeeCoin !== false}
              onValueChange={v => updateTheme({ showRupeeCoin: v })}
              trackColor={{ true: colors.primary[500], false: colors.gray[200] }}
              thumbColor="#FFF"
            />
          </View>
        </View>

        {/* SidePanel Items Manager */}
        <View style={[styles.cardSection, { backgroundColor: colors.white, borderRadius: radius.lg }]}>
          <View style={styles.sectionHeaderRow}>
            <Layers size={20} color={colors.primary[600]} />
            <Text style={[styles.sectionTitle, { color: colors.gray[900] }]}>Side Panel Menu Shortcuts</Text>
          </View>

          {sidePanelItems.map(item => (
            <View key={item.id} style={[styles.toggleRow, { borderBottomColor: colors.gray[100] }]}>
              <Text style={[styles.toggleText, { color: colors.gray[900] }]}>
                {item.id.replace('-', ' ').replace(/\b\w/g, c => c.toUpperCase())}
              </Text>
              <Switch
                value={item.visible}
                onValueChange={() => toggleSidePanelVisibility(item.id)}
                trackColor={{ true: colors.primary[500], false: colors.gray[200] }}
                thumbColor="#FFF"
              />
            </View>
          ))}
        </View>

        {/* Reset Action */}
        <TouchableOpacity style={styles.resetCardBtn} onPress={() => setConfirmReset(true)}>
          <RotateCcw size={18} color={colors.danger[500]} />
          <Text style={[styles.resetCardText, { color: colors.danger[600] }]}>Reset All Theme Customizations</Text>
        </TouchableOpacity>
      </ScrollView>

      {confirmReset && (
        <ConfirmActionSheet
          visible={confirmReset}
          title="Reset Customization?"
          description="This will restore default colors, dark mode preference, font size, and dashboard layout."
          confirmLabel="Reset All"
          actionType="delete"
          onConfirm={async () => {
            setConfirmReset(false);
            await resetAll();
          }}
          onCancel={() => setConfirmReset(false)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  mainContainer: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  backBtn: {
    padding: 6,
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: 'DMSans_700Bold',
  },
  resetHeaderBtn: {
    padding: 6,
  },
  scroll: {
    flex: 1,
  },
  cardSection: {
    padding: 16,
    marginBottom: 16,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: 'DMSans_700Bold',
  },
  sectionSubtitle: {
    fontSize: 12,
    fontFamily: 'DMSans_400Regular',
    marginBottom: 16,
  },
  paletteGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },
  paletteCard: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1.5,
    gap: 10,
  },
  swatchCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  paletteName: {
    fontSize: 13,
    fontFamily: 'DMSans_500Medium',
  },
  previewCard: {
    padding: 16,
    borderRadius: 16,
    marginTop: 8,
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  previewTitle: {
    color: '#FFF',
    fontSize: 12,
    fontFamily: 'DMSans_500Medium',
  },
  previewAmount: {
    color: '#FFF',
    fontSize: 24,
    fontFamily: 'DMSans_700Bold',
    marginTop: 8,
  },
  previewSub: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 11,
    marginTop: 2,
  },
  optionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  modePill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 8,
  },
  modePillText: {
    fontSize: 13,
    fontFamily: 'DMSans_700Bold',
  },
  fontOption: {
    flex: 1,
    padding: 10,
    alignItems: 'center',
    borderWidth: 1,
  },
  fontLabel: {
    fontSize: 16,
    fontFamily: 'DMSans_700Bold',
  },
  fontSub: {
    fontSize: 10,
    marginTop: 2,
  },
  previewTextSample: {
    marginTop: 16,
    fontFamily: 'DMSans_500Medium',
  },
  radiusGrid: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  radiusTile: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1.5,
  },
  radiusTileText: {
    fontSize: 12,
    fontFamily: 'DMSans_700Bold',
  },
  widgetList: {
    marginTop: 12,
  },
  widgetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  reorderBtns: {
    flexDirection: 'column',
    gap: 4,
  },
  arrowBtn: {
    padding: 4,
  },
  widgetName: {
    fontSize: 14,
    fontFamily: 'DMSans_700Bold',
  },
  widgetDesc: {
    fontSize: 11,
    marginTop: 2,
  },
  variantList: {
    gap: 10,
    marginTop: 12,
  },
  variantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderWidth: 1,
  },
  radioDotOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#9CA3AF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioDotInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  variantName: {
    fontSize: 14,
    fontFamily: 'DMSans_700Bold',
  },
  variantDesc: {
    fontSize: 11,
    marginTop: 2,
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  toggleText: {
    fontSize: 14,
    fontFamily: 'DMSans_500Medium',
  },
  resetCardBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    backgroundColor: '#FEE2E2',
    borderRadius: 16,
    marginTop: 12,
  },
  resetCardText: {
    fontSize: 14,
    fontFamily: 'DMSans_700Bold',
  },
});
