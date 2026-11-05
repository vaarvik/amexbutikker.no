import { HStack, Image, Link, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import {
  containerBackground,
  font,
  foregroundStyle,
  frame,
  lineLimit,
  padding,
  widgetURL,
} from '@expo/ui/swift-ui/modifiers';
import { createWidget } from 'expo-widgets';
import type { WidgetEnvironment } from 'expo-widgets';
import type { NearbyWidgetProps } from '../widgets/widgets.model';
import type { ExpoWidget } from '../widgets/widgets.ports';

/**
 * The "Tar de Amex?" widget: home screen (small, medium) and lock screen. It runs in the widget
 * extension, not in the app: everything it uses is inside the function, and it only reads the
 * props that `SnapshotNearbyWidgetService` writes.
 */
function NearbyWidget(props: NearbyWidgetProps, environment: WidgetEnvironment) {
  'widget';
  const family = environment.widgetFamily ?? 'systemSmall';
  const here = props.here;
  const secondary = foregroundStyle({ type: 'hierarchical', style: 'secondary' });
  const background = containerBackground({ type: 'hierarchical', style: 'quinary' }, 'widget');
  const link = here === null ? [] : [widgetURL(here.url)];

  if (family === 'accessoryInline') {
    return (
      <Text modifiers={link}>
        {here === null ? 'Tar de Amex?' : `${here.name}: ${here.answer}`}
      </Text>
    );
  }

  if (family === 'accessoryRectangular') {
    return (
      <VStack alignment="leading" spacing={2} modifiers={[...link, background]}>
        <Text modifiers={[font({ weight: 'semibold', size: 15 }), lineLimit(1)]}>
          {here === null ? 'Tar de Amex?' : here.name}
        </Text>
        <HStack spacing={4}>
          {here === null ? null : <Image systemName={here.symbol as 'questionmark.circle'} />}
          <Text>{here === null ? 'Ingen steder rett her' : here.answer}</Text>
        </HStack>
      </VStack>
    );
  }

  const herePanel = (
    <VStack alignment="leading" spacing={4}>
      <Text modifiers={[font({ weight: 'semibold', size: 12 }), secondary]}>
        {here === null ? 'TAR DE AMEX?' : 'DU ER HER'}
      </Text>
      {here === null ? (
        <Text modifiers={[font({ weight: 'semibold', size: 15 }), lineLimit(3)]}>
          Ingen steder rett her
        </Text>
      ) : (
        <VStack alignment="leading" spacing={6}>
          <Text modifiers={[font({ weight: 'bold', size: 17 }), lineLimit(2)]}>{here.name}</Text>
          <HStack spacing={6}>
            <Image systemName={here.symbol as 'questionmark.circle'} size={22} color={here.color} />
            <Text modifiers={[font({ weight: 'bold', size: 20 }), lineLimit(1)]}>
              {here.answer}
            </Text>
          </HStack>
        </VStack>
      )}
      <Spacer />
      <Text modifiers={[font({ size: 11 }), secondary]}>{props.updated}</Text>
    </VStack>
  );

  if (family === 'systemSmall') {
    return (
      <VStack
        alignment="leading"
        modifiers={[...link, frame({ maxWidth: 10_000, alignment: 'leading' }), background]}
      >
        {herePanel}
      </VStack>
    );
  }

  return (
    <HStack alignment="top" spacing={16} modifiers={[...link, padding({ all: 2 }), background]}>
      {herePanel}
      <VStack alignment="leading" spacing={6}>
        <Text modifiers={[font({ weight: 'semibold', size: 12 }), secondary]}>
          TAR AMEX I NÆRHETEN
        </Text>
        {props.accepted.length === 0 ? (
          <Text modifiers={[font({ size: 14 }), secondary]}>Ingen kjente ennå</Text>
        ) : (
          props.accepted.map((place) => (
            <Link key={place.url} destination={place.url}>
              <HStack spacing={6}>
                <Image systemName="checkmark.circle.fill" size={14} color="#1E6B34" />
                <Text modifiers={[font({ size: 14 }), lineLimit(1)]}>{place.name}</Text>
                <Spacer />
                <Text modifiers={[font({ size: 12 }), secondary]}>{place.distance}</Text>
              </HStack>
            </Link>
          ))
        )}
        <Spacer />
      </VStack>
    </HStack>
  );
}

/**
 * The iOS widget; `nearby-widget.tsx` is the stand-in for other platforms. A build without the
 * widget extension (an older development build) gets no widget instead of a crash.
 */
function create(): ExpoWidget<NearbyWidgetProps> | null {
  try {
    return createWidget<NearbyWidgetProps>('NearbyWidget', NearbyWidget, {
      here: null,
      accepted: [],
      updated: '',
    });
  } catch {
    return null;
  }
}

export const nearbyWidget: ExpoWidget<NearbyWidgetProps> | null = create();
