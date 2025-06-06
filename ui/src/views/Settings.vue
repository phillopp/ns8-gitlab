<!--
  Copyright (C) 2023 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->
<template>
  <cv-grid fullWidth>
    <cv-row>
      <cv-column class="page-title">
        <h2>{{ $t("settings.title") }}</h2>
      </cv-column>
    </cv-row>
    <cv-row v-if="error.getConfiguration">
      <cv-column>
        <NsInlineNotification
            kind="error"
            :title="$t('action.get-configuration')"
            :description="error.getConfiguration"
            :showCloseButton="false"
        />
      </cv-column>
    </cv-row>
    <cv-row>
      <cv-column>
        <cv-tile light>
          <cv-form @submit.prevent="configureModule">
            <!-- TODO remove test field and code configuration fields -->
            <cv-text-input
                :label="$t('settings.host')"
                v-model="host"
                placeholder="git.example.org"
                :disabled="loading.getConfiguration || loading.configureModule"
                :invalid-message="error.host"
                ref="host"
            ></cv-text-input>
            <cv-text-input
                :label="$t('settings.password')"
                v-model="password"
                :disabled="loading.getConfiguration || loading.configureModule"
                :invalid-message="error.password"
                ref="password"
            ></cv-text-input>
            <NsComboBox
                v-model.trim="ldap_domain"
                :autoFilter="true"
                :autoHighlight="true"
                :title="$t('settings.ldap_domain')"
                :label="$t('settings.choose_ldap_domain')"
                :options="ldap_domain_list"
                :acceptUserInput="false"
                :showItemType="true"
                :invalid-message="$t(error.ldap_domain)"
                :disabled="loading.getConfiguration || loading.configureModule"
                tooltipAlignment="start"
                tooltipDirection="top"
                ref="ldap_domain"
            >
              <template slot="tooltip">
                {{
                  $t("settings.choose_the_ldap_domain_to_authenticate_users")
                }}
              </template>
            </NsComboBox>
            <cv-text-input
                :label="$t('settings.registry_host')"
                v-model="registryHost"
                placeholder="registry.example.org"
                :disabled="loading.getConfiguration || loading.configureModule"
                :invalid-message="error.registryHost"
                ref="registryHost"
            ></cv-text-input>
            <cv-row v-if="error.configureModule">
              <cv-column>
                <NsInlineNotification
                    kind="error"
                    :title="$t('action.configure-module')"
                    :description="error.configureModule"
                    :showCloseButton="false"
                />
              </cv-column>
            </cv-row>
            <NsButton
                kind="primary"
                :icon="Save20"
                :loading="loading.configureModule"
                :disabled="loading.getConfiguration || loading.configureModule"
            >{{ $t("settings.save") }}
            </NsButton
            >
          </cv-form>
        </cv-tile>
      </cv-column>
    </cv-row>
  </cv-grid>
</template>

<script>
import to from "await-to-js";
import { mapState } from "vuex";
import {
  QueryParamService,
  UtilService,
  TaskService,
  IconService,
  PageTitleService,
} from "@nethserver/ns8-ui-lib";

export default {
  name: "Settings",
  mixins: [
    TaskService,
    IconService,
    UtilService,
    QueryParamService,
    PageTitleService,
  ],
  pageTitle() {
    return this.$t("settings.title") + " - " + this.appName;
  },
  data() {
    return {
      q: {
        page: "settings",
      },
      urlCheckInterval: null,
      host: "",
      password: "",
      ldap_domain: "",
      ldap_domain_list: [],
      registryHost: "",
      loading: {
        getConfiguration: false,
        configureModule: false,
      },
      error: {
        getConfiguration: "",
        configureModule: "",
        host: "",
        password: "",
        ldap_domain: "",
        ldap_domain_list: "",
        registryHost: "",
        runner_token: "",
      },
    };
  },
  computed: {
    ...mapState(["instanceName", "core", "appName"]),
  },
  beforeRouteEnter(to, from, next) {
    next((vm) => {
      vm.watchQueryData(vm);
      vm.urlCheckInterval = vm.initUrlBindingForApp(vm, vm.q.page);
    });
  },
  beforeRouteLeave(to, from, next) {
    clearInterval(this.urlCheckInterval);
    next();
  },
  created() {
    this.getConfiguration();
  },
  methods: {
    async getConfiguration() {
      this.loading.getConfiguration = true;
      this.error.getConfiguration = "";
      const taskAction = "get-configuration";
      const eventId = this.getUuid();

      // register to task error
      this.core.$root.$once(
        `${taskAction}-aborted-${eventId}`,
        this.getConfigurationAborted
      );

      // register to task completion
      this.core.$root.$once(
        `${taskAction}-completed-${eventId}`,
        this.getConfigurationCompleted
      );

      const res = await to(
        this.createModuleTaskForApp(this.instanceName, {
          action: taskAction,
          extra: {
            title: this.$t("action." + taskAction),
            isNotificationHidden: true,
            eventId,
          },
        })
      );
      const err = res[0];

      if (err) {
        console.error(`error creating task ${taskAction}`, err);
        this.error.getConfiguration = this.getErrorMessage(err);
        this.loading.getConfiguration = false;
        return;
      }
    },
    getConfigurationAborted(taskResult, taskContext) {
      console.error(`${taskContext.action} aborted`, taskResult);
      this.error.getConfiguration = this.$t("error.generic_error");
      this.loading.getConfiguration = false;
    },
    getConfigurationCompleted(taskContext, taskResult) {
      this.loading.getConfiguration = false;
      const config = taskResult.output;

      // TODO set configuration fields
      // ...

      // TODO remove
      console.log("config", config);

      this.host = config.host;
      this.password = config.password;
      this.ldap_domain = config.ldap_domain;
      this.ldap_domain_list = config.ldap_domain_list;
      this.registryHost = config.registry_host;

      // TODO focus first configuration field
      this.focusElement("host");
    },
    validateConfigureModule() {
      this.clearErrors(this);
      let isValidationOk = true;

      // TODO remove host and validate configuration fields
      if (!this.host) {
        // test field cannot be empty
        this.error.host = this.$t("common.required");

        if (isValidationOk) {
          this.focusElement("host");
          isValidationOk = false;
        }
      }
      return isValidationOk;
    },
    configureModuleValidationFailed(validationErrors) {
      this.loading.configureModule = false;

      for (const validationError of validationErrors) {
        const param = validationError.parameter;

        // set i18n error message
        this.error[param] = this.$t("settings." + validationError.error);
      }
    },
    async configureModule() {
      const isValidationOk = this.validateConfigureModule();
      if (!isValidationOk) {
        return;
      }

      this.loading.configureModule = true;
      const taskAction = "configure-module";
      const eventId = this.getUuid();

      // register to task error
      this.core.$root.$once(
        `${taskAction}-aborted-${eventId}`,
        this.configureModuleAborted
      );

      // register to task validation
      this.core.$root.$once(
        `${taskAction}-validation-failed-${eventId}`,
        this.configureModuleValidationFailed
      );

      // register to task completion
      this.core.$root.$once(
        `${taskAction}-completed-${eventId}`,
        this.configureModuleCompleted
      );

      const res = await to(
        this.createModuleTaskForApp(this.instanceName, {
          action: taskAction,
          data: {
            host: this.host,
            http2https: true,
            lets_encrypt: true,
            password: this.password,
            ldap_domain: this.ldap_domain,
            registry_host: this.registryHost
            // TODO configuration fields
          },
          extra: {
            title: this.$t("settings.configure_instance", {
              instance: this.instanceName,
            }),
            description: this.$t("common.processing"),
            eventId,
          },
        })
      );
      console.log(res);
      const err = res[0];

      if (err) {
        console.error(`error creating task ${taskAction}`, err);
        this.error.configureModule = this.getErrorMessage(err);
        this.loading.configureModule = false;
      }
    },
    configureModuleAborted(taskResult, taskContext) {
      console.error(`${taskContext.action} aborted`, taskResult);
      this.error.configureModule = this.$t("error.generic_error");
      this.loading.configureModule = false;
    },
    configureModuleCompleted() {
      this.loading.configureModule = false;

      // reload configuration
      this.getConfiguration();
    },
  },
};
</script>

<style scoped lang="scss">
@import "../styles/carbon-utils";
</style>
