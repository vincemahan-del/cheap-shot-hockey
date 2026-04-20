// Cheap Shot Hockey — mabl full-SDLC demo pipeline
//
// This pipeline is the on-stage script for demoing mabl at every stage of
// the SDLC. It mirrors what a real-world customer might run in Jenkins
// today and shows how mabl plugs in at the quality gates.
//
// Required Jenkins credentials:
//   mabl-api-token       String     — mabl REST API token (Settings → APIs)
//   vercel-token         String     — (optional) Vercel CLI token for preview deploys
//   github-token         String     — for commenting on the PR
//
// Required environment variables (set in Jenkins global config or via
// withEnv blocks downstream):
//   MABL_WORKSPACE_ID    — mabl workspace UUID
//   MABL_APPLICATION_ID  — mabl application UUID for cheap-shot-hockey
//   MABL_ENV_PREVIEW_ID  — mabl environment UUID for preview deploys
//   MABL_ENV_PROD_ID     — mabl environment UUID for production
//   PRODUCTION_URL       — e.g. https://cheap-shot-hockey.vercel.app
//
// How to demo it: see docs/SDLC-DEMO.md

pipeline {
  agent any

  options {
    timestamps()
    timeout(time: 30, unit: 'MINUTES')
    buildDiscarder(logRotator(numToKeepStr: '25'))
  }

  environment {
    MABL_API_TOKEN = credentials('mabl-api-token')
    NODE_ENV       = 'production'
    // Ensure Homebrew-installed node/npm/jq are on PATH for Jenkins (macOS local).
    PATH           = "/opt/homebrew/bin:/opt/homebrew/sbin:/usr/local/bin:${env.PATH}"
  }

  stages {

    stage('1. Checkout') {
      steps {
        checkout scm
        script {
          env.GIT_COMMIT_SHORT = sh(
            script: "git rev-parse --short HEAD",
            returnStdout: true,
          ).trim()
          env.GIT_BRANCH_NAME = sh(
            script: "git rev-parse --abbrev-ref HEAD",
            returnStdout: true,
          ).trim()
          echo "Commit: ${env.GIT_COMMIT_SHORT} on ${env.GIT_BRANCH_NAME}"
        }
      }
    }

    stage('2. Install + Build') {
      steps {
        sh 'node --version'
        sh 'npm ci'
        sh 'npm run build'
      }
    }

    stage('3. Deploy preview') {
      when { not { branch 'main' } }
      steps {
        script {
          // Your org likely has a preferred preview-deploy flow. This block
          // shows three common options — uncomment the one you use.

          // Option A: Vercel CLI (what this repo uses)
          // withCredentials([string(credentialsId: 'vercel-token', variable: 'VERCEL_TOKEN')]) {
          //   env.PREVIEW_URL = sh(
          //     script: "npx vercel --token $VERCEL_TOKEN --confirm --prebuilt",
          //     returnStdout: true,
          //   ).trim()
          // }

          // Option B: your in-house PaaS
          // env.PREVIEW_URL = sh(script: "./infra/deploy-preview.sh", returnStdout: true).trim()

          // Option C: ephemeral namespace on k8s
          // env.PREVIEW_URL = sh(script: "./infra/k8s-preview.sh", returnStdout: true).trim()

          // Placeholder for the demo: point at the real prod URL
          env.PREVIEW_URL = env.PRODUCTION_URL ?: "https://cheap-shot-hockey.vercel.app"
          echo "Preview URL: ${env.PREVIEW_URL}"
        }
      }
    }

    stage('4. mabl — API smoke (shift-left)') {
      steps {
        sh """
          ./scripts/mabl-deployment.sh \\
            --environment $MABL_ENV_PREVIEW_ID \\
            --application $MABL_APPLICATION_ID \\
            --labels api-smoke \\
            --url "$PREVIEW_URL" \\
            --commit "$GIT_COMMIT_SHORT" \\
            --branch "$GIT_BRANCH_NAME" \\
            --wait
        """
      }
    }

    stage('5. mabl — UI tests on PR surface') {
      when { not { branch 'main' } }
      steps {
        // AI-driven test selection would live here. For the demo we use
        // plan_labels="pr-gate" to scope to the smallest meaningful set.
        sh """
          ./scripts/mabl-deployment.sh \\
            --environment $MABL_ENV_PREVIEW_ID \\
            --application $MABL_APPLICATION_ID \\
            --labels pr-gate \\
            --url "$PREVIEW_URL" \\
            --commit "$GIT_COMMIT_SHORT" \\
            --branch "$GIT_BRANCH_NAME" \\
            --wait
        """
      }
    }

    stage('6. mabl — full regression (main only)') {
      when { branch 'main' }
      steps {
        sh """
          ./scripts/mabl-deployment.sh \\
            --environment $MABL_ENV_PROD_ID \\
            --application $MABL_APPLICATION_ID \\
            --labels regression \\
            --url "$PRODUCTION_URL" \\
            --commit "$GIT_COMMIT_SHORT" \\
            --branch "$GIT_BRANCH_NAME" \\
            --wait
        """
      }
    }

    stage('7. Promote to production') {
      when {
        allOf {
          branch 'main'
          expression { currentBuild.currentResult == 'SUCCESS' }
        }
      }
      steps {
        // Vercel auto-deploys from main on push, so this stage is advisory.
        // In non-Vercel orgs, this is where `kubectl apply`, `aws ecs update-service`,
        // or `helm upgrade` would run — gated on the mabl runs above.
        echo "Production promotion: Vercel is auto-deploying commit ${env.GIT_COMMIT_SHORT}."
      }
    }

    stage('8. Post-deploy smoke') {
      when { branch 'main' }
      steps {
        script {
          def url = env.PRODUCTION_URL ?: "https://cheap-shot-hockey.vercel.app"
          // Wait for the deploy to reflect the new commit, then smoke.
          sh """
            set -e
            for i in \$(seq 1 30); do
              live_sha=\$(curl -fsS $url/api/build-info | jq -r '.commit' | cut -c1-7)
              echo "live sha: \$live_sha vs expected ${env.GIT_COMMIT_SHORT}"
              if [ "\$live_sha" = "${env.GIT_COMMIT_SHORT}" ]; then
                echo "deploy reflects new commit"
                break
              fi
              sleep 10
            done
            curl -fsS $url/api/health | jq .
          """
          sh """
            ./scripts/mabl-deployment.sh \\
              --environment $MABL_ENV_PROD_ID \\
              --application $MABL_APPLICATION_ID \\
              --labels post-deploy-smoke \\
              --url "$url" \\
              --commit "$GIT_COMMIT_SHORT" \\
              --branch "main" \\
              --wait
          """
        }
      }
    }
  }

  post {
    failure {
      script {
        // On red, trigger the mabl failure-analysis flow.
        // Your incident tooling of choice would be called here (PagerDuty,
        // Slack, etc.). For the demo we just write a log line.
        echo "❌ Pipeline failed at stage ${env.STAGE_NAME}. Running mabl failure analysis…"
        sh './scripts/mabl-analyze-last-failure.sh || true'
      }
    }
    always {
      echo "Pipeline finished: ${currentBuild.currentResult}"
    }
  }
}
