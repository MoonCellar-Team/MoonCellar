import { useUpdateProfileMutation } from "@/src/lib/entities/user/api/user.mutations";
import { usePushSubscription } from "@/src/lib/entities/notification/model/usePushSubscription";
import { useAuthStore } from "@/src/lib/shared/store/auth.store";
import { useGeoStore } from "@/src/lib/shared/store/geo.store";
import { useSettingsStore } from "@/src/lib/shared/store/settings.store";
import { useInstallApp } from "@/src/lib/shared/hooks/useInstallApp";
import { ANDROID_APK_URL } from "@/src/lib/shared/utils/install.utils";
import { useStatesStore } from "@/src/lib/shared/store/states.store";
import { AvatarSettings } from "@/src/lib/shared/ui/AvatarSettings";
import { Button, ButtonColor } from "@/src/lib/shared/ui/Button";
import { UploadButton } from "@/src/lib/shared/ui/Fields";
import { Input } from "@/src/lib/shared/ui/Input";
import { RangeSelector } from "@/src/lib/shared/ui/RangeSelector";
import { Textarea } from "@/src/lib/shared/ui/Textarea";
import { ToggleSwitch } from "@/src/lib/shared/ui/ToggleSwitch";
import { toast } from "@/src/lib/shared/utils/toast.utils";
import { SectionTitle } from "@/src/lib/shared/ui/SectionTitle";
import { modal } from "@/src/lib/shared/ui/Modal";
import {
  DELETE_ACCOUNT_MODAL_ID,
  DeleteAccountModal,
} from "@/src/lib/features/user/ui/DeleteAccountModal";
import { RaAccount } from "@/src/lib/features/user/ui/RaAccount";
import { SteamAccount } from "@/src/lib/features/user/ui/SteamAccount";
import { GameDevices } from "@/src/lib/features/user/ui/GameDevices";
import { TwoFactorSettings } from "@/src/lib/features/user/ui/TwoFactorSettings";
import { zodResolver } from "@hookform/resolvers/zod";
import { FC, useEffect, useState } from "react";
import { SubmitHandler, useForm } from "react-hook-form";
import styles from "./Settings.module.scss";
import { settingsSchema, SettingsSchema } from "./settings.schema";
import { PROFILE_BLOCK_LABELS } from "@/src/lib/shared/constants/user.const";
import { CollapsibleSection } from "@/src/lib/shared/ui/Fields";
import {
  DEFAULT_BG_OPACITY,
  IMutableNotificationType,
  IProfileBlock,
  IUpdateUserSettingsRequest,
  MUTABLE_NOTIFICATION_TYPES,
  NOTIFICATION_SETTING_LABELS,
} from "@mooncellar/schemas";

interface SettingsProps {}

export const Settings: FC<SettingsProps> = ({}) => {
  const { profile } = useAuthStore();
  const { mutate: updateProfile, isPending } = useUpdateProfileMutation();
  const setBgOpacityPreview = useSettingsStore((s) => s.setBgOpacityPreview);
  const isMobile = useStatesStore((s) => s.isMobile);
  const push = usePushSubscription();
  const installApp = useInstallApp();

  const profileBgOpacity = profile?.settings?.bgOpacity ?? DEFAULT_BG_OPACITY;
  const blockedCountry = useGeoStore((s) => s.blockedCountry);
  const isGeoResolved = useGeoStore((s) => s.resolved);
  const isAdultSettingShown = isGeoResolved && !blockedCountry;

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<SettingsSchema>({
    resolver: zodResolver(settingsSchema),
    mode: "onBlur",
    defaultValues: {
      userName: profile?.userName,
      email: profile?.email,
      description: profile?.description,
      showAdultContent: !!profile?.settings?.showAdultContent,
      bgOpacity: Math.round(profileBgOpacity * 100),
      mutedNotifications: profile?.settings?.mutedNotifications ?? [],
      hiddenProfileBlocks: profile?.settings?.hiddenProfileBlocks ?? [],
    },
  });

  useEffect(() => () => setBgOpacityPreview(undefined), [setBgOpacityPreview]);

  useEffect(() => {
    if (!profile) return;
    reset({
      userName: profile.userName,
      email: profile.email,
      description: profile.description,
      showAdultContent: !!profile.settings?.showAdultContent,
      bgOpacity: Math.round(
        (profile.settings?.bgOpacity ?? DEFAULT_BG_OPACITY) * 100
      ),
      mutedNotifications: profile.settings?.mutedNotifications ?? [],
      hiddenProfileBlocks: profile.settings?.hiddenProfileBlocks ?? [],
    });
  }, [profile, reset]);

  const showAdultContent = watch("showAdultContent");
  const bgOpacity = watch("bgOpacity");
  const mutedNotifications = watch("mutedNotifications");
  const hiddenProfileBlocks = watch("hiddenProfileBlocks");

  const toggleProfileBlock = (block: IProfileBlock, isVisible: boolean) =>
    setValue(
      "hiddenProfileBlocks",
      isVisible
        ? hiddenProfileBlocks.filter((hidden) => hidden !== block)
        : [...hiddenProfileBlocks, block],
      { shouldDirty: true }
    );

  const toggleNotification = (
    type: IMutableNotificationType,
    isEnabled: boolean
  ) =>
    setValue(
      "mutedNotifications",
      isEnabled
        ? mutedNotifications.filter((muted) => muted !== type)
        : [...mutedNotifications, type],
      { shouldDirty: true }
    );

  const onSubmit: SubmitHandler<SettingsSchema> = (data) => {
    if (!profile) return;

    const settings: IUpdateUserSettingsRequest = {};

    if (
      isAdultSettingShown &&
      data.showAdultContent !== !!profile.settings?.showAdultContent
    ) {
      settings.showAdultContent = !!data.showAdultContent;
    }

    if (data.bgOpacity / 100 !== profileBgOpacity) {
      settings.bgOpacity = data.bgOpacity / 100;
    }

    const savedHidden = profile.settings?.hiddenProfileBlocks ?? [];

    if (
      data.hiddenProfileBlocks.length !== savedHidden.length ||
      data.hiddenProfileBlocks.some((block) => !savedHidden.includes(block))
    ) {
      settings.hiddenProfileBlocks = data.hiddenProfileBlocks;
    }

    const savedMuted = profile.settings?.mutedNotifications ?? [];

    if (
      data.mutedNotifications.length !== savedMuted.length ||
      data.mutedNotifications.some((type) => !savedMuted.includes(type))
    ) {
      settings.mutedNotifications = data.mutedNotifications;
    }

    updateProfile(
      {
        userId: profile._id,
        ...(data.description !== profile.description && {
          description: data.description ?? "",
        }),
        ...(tempAvatar && { avatar: tempAvatar }),
        ...(background && { background }),
        ...(!!Object.keys(settings).length && { settings }),
      },
      {
        onSuccess: () => {
          toast.success({ description: "Saved successfully" });
          setTempAvatar(undefined);
          setBackground(undefined);
          setBgOpacityPreview(undefined);
        },
      }
    );
  };

  const [tempAvatar, setTempAvatar] = useState<File>();
  const [background, setBackground] = useState<File>();

  const backgroundFileName = profile?.background
    ? profile.background.split("/").pop()
    : null;

  return (
    <form className={styles.container} onSubmit={handleSubmit(onSubmit)}>
      <SectionTitle>Profile Settings</SectionTitle>

      <div className={styles.sections}>
        <CollapsibleSection title="Account" isStatic>
          <div className={styles.section}>
            <div className={styles.identity}>
              <div className={styles.identity__avatar}>
                <AvatarSettings
                  tempAvatar={tempAvatar}
                  setTempAvatar={setTempAvatar}
                />
              </div>
              <div className={styles.identity__fields}>
                <div className={styles.field}>
                  <label htmlFor="userName">User Name</label>
                  <Input
                    id="userName"
                    className={styles.input}
                    containerClassname={styles.input}
                    {...register("userName")}
                    error={errors.userName}
                  />
                </div>
                <div className={styles.field}>
                  <label htmlFor="email">Email</label>
                  <Input
                    type="email"
                    id="email"
                    className={styles.input}
                    containerClassname={styles.input}
                    {...register("email")}
                    error={errors.email}
                  />
                </div>
              </div>
            </div>
            <div className={styles.field}>
              <label htmlFor="description">Description</label>
              <Textarea
                id="description"
                className={styles.input}
                classNameField={styles.input}
                error={errors.description}
                {...register("description")}
              />
            </div>
          </div>
        </CollapsibleSection>

        <CollapsibleSection title="Two-factor sign-in">
          <div className={styles.section}>
            <TwoFactorSettings />
          </div>
        </CollapsibleSection>

        <CollapsibleSection title="Notifications">
          <div className={styles.toggles}>
            {push.state !== "unavailable" && push.state !== "checking" && (
              <div className={styles.prefRow}>
                <ToggleSwitch
                  label="Push notifications on this device"
                  hint={
                    push.state === "denied"
                      ? "Blocked in the browser settings for this site."
                      : push.state === "tab"
                        ? "This browser has no push service: notifications arrive only while a MoonCellar tab is open."
                        : "Replies, comments on your reviews, request decisions and wishlist releases."
                  }
                  checked={push.state === "on" || push.state === "tab"}
                  isDisabled={push.state === "busy" || push.state === "denied"}
                  onChange={(value) => (value ? push.enable() : push.disable())}
                />
              </div>
            )}
            {MUTABLE_NOTIFICATION_TYPES.map((type) => (
              <div key={type} className={styles.prefRow}>
                <ToggleSwitch
                  label={NOTIFICATION_SETTING_LABELS[type]}
                  checked={!mutedNotifications.includes(type)}
                  onChange={(value) => toggleNotification(type, value)}
                />
              </div>
            ))}
          </div>
        </CollapsibleSection>

        <CollapsibleSection title="Steam" isKeptMounted>
          <div className={styles.section}>
            <SteamAccount />
          </div>
        </CollapsibleSection>

        <CollapsibleSection title="RetroAchievements">
          <div className={styles.section}>
            <RaAccount />
          </div>
        </CollapsibleSection>

        <CollapsibleSection title="Game devices">
          <div className={styles.section}>
            <GameDevices />
          </div>
        </CollapsibleSection>

        <CollapsibleSection title="Profile page">
          <div className={styles.toggles}>
            {(Object.keys(PROFILE_BLOCK_LABELS) as IProfileBlock[]).map(
              (block) => (
                <div key={block} className={styles.prefRow}>
                  <ToggleSwitch
                    label={PROFILE_BLOCK_LABELS[block]}
                    checked={!hiddenProfileBlocks.includes(block)}
                    onChange={(value) => toggleProfileBlock(block, value)}
                  />
                </div>
              )
            )}
          </div>
        </CollapsibleSection>

        <CollapsibleSection title="Appearance">
          <div className={styles.section}>
            <div className={styles.field}>
              <span className={styles.label}>Background</span>
              {backgroundFileName && (
                <span className={styles.fileName}>
                  Current: {backgroundFileName}
                </span>
              )}
              <UploadButton
                label="Choose background"
                onFile={setBackground}
                fileName={background ? `New: ${background.name}` : null}
                isFullWidthOnMobile
              />
            </div>
            <RangeSelector
              defaultValue={bgOpacity}
              callback={(val) => setBgOpacityPreview(val / 100)}
              finalCallback={(val) =>
                setValue("bgOpacity", val, { shouldDirty: true })
              }
              min={0}
              max={100}
              text="Background dim"
              isWithValue
              formatValue={(value) => `${value}%`}
              step={1}
            />
          </div>
        </CollapsibleSection>

        <CollapsibleSection title="App">
          <div className={styles.section}>
            {installApp.isInstalled ? (
              <span className={styles.note}>
                You are using the installed MoonCellar app.
              </span>
            ) : installApp.canInstall ? (
              <div className={styles.prefRow}>
                <span className={styles.note}>
                  Install MoonCellar as an app on this device.
                </span>
                <Button type="button" onClick={installApp.install}>
                  Install
                </Button>
              </div>
            ) : (
              <span className={styles.note}>
                To install MoonCellar as an app, open the browser menu and
                choose Install or Add to Home screen. In Firefox this is the way
                to get it without an address bar.
              </span>
            )}
            <span className={styles.note}>
              On Android you can also{" "}
              <a href={ANDROID_APK_URL} target="_blank" rel="noreferrer">
                download the APK
              </a>
              . Chrome opens it without an address bar; if your default browser
              is Firefox, install from Firefox instead.
            </span>
          </div>
        </CollapsibleSection>

        {isAdultSettingShown && (
          <CollapsibleSection title="Preferences">
            <div className={styles.toggles}>
              <div className={styles.prefRow}>
                <ToggleSwitch
                  label="Show adult content"
                  checked={!!showAdultContent}
                  onChange={(value) =>
                    setValue("showAdultContent", value, { shouldDirty: true })
                  }
                />
              </div>
            </div>
          </CollapsibleSection>
        )}
      </div>

      <div className={styles.actions}>
        <Button
          type="submit"
          className={styles.btn}
          color={ButtonColor.ACCENT}
          disabled={isPending}
        >
          Save
        </Button>
      </div>

      <CollapsibleSection title="Danger zone">
        <div className={styles.section}>
          <div className={styles.prefRow}>
            <span className={styles.label}>
              Delete your account and everything in it.
            </span>
            <Button
              type="button"
              color={ButtonColor.RED}
              onClick={() =>
                modal.open(<DeleteAccountModal />, {
                  id: DELETE_ACCOUNT_MODAL_ID,
                })
              }
            >
              Delete account
            </Button>
          </div>
        </div>
      </CollapsibleSection>
    </form>
  );
};
